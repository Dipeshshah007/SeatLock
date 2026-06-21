# Concurrency Design Deep Dive

This document is a standalone explanation of SeatLock's core engineering problem and solution — written so it can be read independently (e.g. linked from a resume or LinkedIn post) without needing the rest of the README.

## The race condition, precisely

Without any protection, a naive seat-booking flow looks like this in pseudocode:

```
function bookSeat(seatId, userId):
    seat = db.get(seatId)
    if seat.status != "AVAILABLE":
        throw Error("Seat not available")
    chargePayment(userId)
    db.update(seatId, status="BOOKED")
```

Now imagine two requests, R1 and R2, for the *same seat*, arriving within a few milliseconds of each other:

```
Time →
R1:  read seat (AVAILABLE) ─────────────────── charge payment ─── write BOOKED
R2:        read seat (AVAILABLE) ─── charge payment ─── write BOOKED
```

Both requests read `AVAILABLE` before either writes `BOOKED`. Both proceed to charge the customer. Both think they succeeded. The business now owes someone a refund, an apology, or — worse — has to tell a customer who showed up at the venue that their seat doesn't exist.

This is a classic **TOCTOU (time-of-check to time-of-use)** bug, and it's exactly the kind of bug that's invisible in manual testing (you, alone, clicking buttons) and only appears under real concurrent load — which is precisely why it's such a common, expensive production incident.

## Why "just use a mutex in the app" doesn't work

A tempting first fix: add an in-memory lock (e.g. a JS `Map<seatId, boolean>`) in the Node process. This fails the moment you run more than one server instance — which you will, for availability. Each process has its own memory; Process A's lock means nothing to Process B. You need a lock that's visible to *every* process talking to the same data — which means the lock has to live in shared infrastructure, not application memory.

## Our approach: pessimistic locking at the database layer

SeatLock uses PostgreSQL's `SELECT ... FOR UPDATE`:

```sql
BEGIN;
SELECT * FROM event_seats WHERE id = $1 FOR UPDATE;
-- at this point, this transaction holds an exclusive lock on this row.
-- any OTHER transaction trying to SELECT ... FOR UPDATE the same row
-- will BLOCK here until this transaction commits or rolls back.
UPDATE event_seats SET status = 'HELD', held_by = $2, held_until = $3 WHERE id = $1;
COMMIT;
```

This is **pessimistic** locking: we assume contention is likely and lock first, rather than **optimistic** locking (proceed, then check a version number at commit time and retry on conflict). For seat booking specifically, pessimistic locking is the right call because:

1. **Contention is genuinely likely** for popular events — optimistic locking would mean lots of wasted retries under exactly the load patterns we expect.
2. **The work being protected is cheap** (a row update), so blocking briefly costs little.
3. **Correctness matters far more than raw throughput** here — losing a few milliseconds of latency is a much better trade than ever double-selling a seat.

(We do also maintain a `version` column on `event_seats`, which is the building block for optimistic locking if a future read-heavy path needed it — but it's not load-bearing for correctness today; `FOR UPDATE` is.)

## Why this is airtight, not just "usually works"

The guarantee doesn't come from careful application code alone — it's backed by a **database constraint**:

```sql
ALTER TABLE event_seats ADD CONSTRAINT event_seats_unique_event_seat UNIQUE (event_id, seat_id);
```

Even if there were a bug in the application logic, Postgres itself would refuse to allow two rows representing the same seat for the same event. Defense in depth: the lock prevents the race from happening in normal operation; the constraint makes the invalid state impossible to persist even if something upstream goes wrong.

## Avoiding deadlocks with multi-seat holds

A user might select 4 seats and hold them all at once. If two users each try to hold overlapping sets of seats — e.g. User A holds `[seat1, seat2]` while User B holds `[seat2, seat1]` (same seats, opposite order) — naive locking can deadlock: A waits for the lock B holds on seat2, B waits for the lock A holds on seat1, forever.

SeatLock avoids this with **deterministic lock ordering**: before locking, we always sort the seat IDs:

```ts
const sortedIds = [...eventSeatIds].sort();
const { rows } = await client.query(
  `SELECT * FROM event_seats WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE`,
  [sortedIds]
);
```

Now every transaction acquires locks in the same global order, regardless of the order the user clicked seats in — which makes circular waits (and therefore deadlocks) structurally impossible.

## Why Redis exists at all, given Postgres already guarantees correctness

If Postgres alone is correct, why add Redis? Two reasons, both about **user experience**, not correctness:

1. **Cheap expiry checks.** To show "this seat is held by someone else, try again in 3:42," you need to know when holds expire. Doing that by querying Postgres on every seat-map render (every few seconds, for every active user) adds load for something that doesn't need transactional guarantees — it's just a countdown. Redis TTL keys give us this for nearly free.
2. **Separation of concerns.** Redis failing should degrade the *experience* (no live countdown) without threatening *correctness* (seats are still safely locked). This is a deliberate design choice: never let a non-critical-path dependency become a single point of failure for a critical guarantee.

If you removed Redis entirely from this codebase, the system would still be correct — slightly less pleasant to use, but never capable of double-booking a seat. That's the test for whether a component belongs in your source-of-truth path or not.

## The safety net: scheduled sweep job

Even with Postgres correctness, seats can get "stuck" in `HELD` if:
- A user closes their browser tab mid-checkout without explicitly canceling
- The app crashes between holding a seat and completing the booking
- A Redis TTL event is somehow missed (we don't even rely on this happening — see above)

A cron job runs every 30 seconds:

```sql
SELECT id FROM event_seats
WHERE status = 'HELD' AND held_until IS NOT NULL AND held_until < now()
FOR UPDATE SKIP LOCKED;
```

`SKIP LOCKED` is the key detail here: if another transaction is *actively* working with one of these rows right now (e.g. a user is mid-checkout, converting their hold to a booking), the sweep job simply skips that row this cycle instead of blocking and waiting. It'll catch it next cycle if it's still stale. This means the cleanup job never adds latency to real user transactions — a classic technique for background maintenance jobs that share tables with live traffic.

## How to verify this isn't just a claim

Run the included test:

```bash
cd backend
npm test
```

The test (`seatLockService.concurrency.test.ts`) creates 20 concurrent "users," fires all 20 hold requests for the *same single seat* simultaneously via `Promise.allSettled`, and asserts exactly one succeeds. This is the kind of test that would have caught the naive-implementation bug described at the top of this document — and it passes reliably against a real PostgreSQL instance.
