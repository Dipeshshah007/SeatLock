import { PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { withTransaction } from '../config/db';
import { redis } from '../config/redis';
import { SeatUnavailableError, ConflictError, NotFoundError } from '../utils/errors';
import { EventSeat } from '../types';

/**
 * ─────────────────────────────────────────────────────────────────────────
 * SEAT LOCKING SERVICE — design notes (read this before touching this file)
 * ─────────────────────────────────────────────────────────────────────────
 *
 * PROBLEM: Two users click "Book" on the same seat within milliseconds of
 * each other. Without protection, both requests could read the seat as
 * AVAILABLE, both proceed to charge payment, and we'd oversell the seat.
 *
 * SOLUTION — two layers, each solving a different part of the problem:
 *
 * 1. POSTGRES ROW-LEVEL LOCKING (source of truth, strong consistency)
 *    When a user tries to hold a seat, we run:
 *        SELECT * FROM event_seats WHERE id = $1 FOR UPDATE
 *    inside a transaction. `FOR UPDATE` takes an exclusive row lock —
 *    if two transactions try to lock the same row concurrently, the
 *    second one BLOCKS until the first one commits or rolls back. So
 *    even at the database level, two requests can never both succeed
 *    in holding the same seat. This is what actually prevents double
 *    booking — it does not depend on Redis being correct.
 *
 * 2. REDIS TTL HOLD (UX layer, fast expiry, distributed-lock flavor)
 *    Once a seat is HELD in Postgres, we also set a Redis key with a TTL
 *    (e.g. 5 minutes) representing the hold. A background job (and a
 *    lazy check on every read) reconciles expired Redis holds back to
 *    Postgres, flipping the seat back to AVAILABLE. This lets us give
 *    users a live countdown ("seat held for 4:32") without hammering
 *    Postgres with a cron job scanning timestamps every second, and
 *    demonstrates a *second*, independent concurrency mechanism that's
 *    common in real distributed ticketing systems (e.g. Ticketmaster-style
 *    holds, BookMyShow-style locks).
 *
 * Why both, instead of just one?
 *  - Postgres alone: correct, but checking "is this hold expired" at
 *    read-time for every seat on every page load means scanning/locking
 *    rows just to check time — wasteful at scale.
 *  - Redis alone: fast, but Redis is not the system of record. A network
 *    partition or Redis restart could lose the lock state entirely and
 *    cause double-booking. Never trust a cache as your only source of
 *    truth for money-related state.
 *  - Together: Postgres guarantees correctness under concurrent writes;
 *    Redis gives cheap, fast expiry semantics for the "soft hold" window.
 *    If Redis is ever unavailable, the system fails safe — Postgres still
 *    enforces uniqueness, we just lose the nice countdown UX temporarily.
 * ─────────────────────────────────────────────────────────────────────────
 */

const HOLD_DURATION_SECONDS = parseInt(process.env.SEAT_HOLD_DURATION_SECONDS || '300', 10); // 5 min

function holdKey(eventSeatId: string): string {
  return `seat-hold:${eventSeatId}`;
}

/**
 * Attempts to place a temporary HOLD on a set of seats for a given user.
 * All seats are locked and updated within a single DB transaction — either
 * every requested seat gets held, or none do (atomic group hold, which
 * matters for "I want these 4 seats together" use cases).
 */
export async function holdSeats(
  eventSeatIds: string[],
  userId: string
): Promise<EventSeat[]> {
  if (eventSeatIds.length === 0) {
    throw new ConflictError('No seats specified');
  }

  return withTransaction(async (client: PoolClient) => {
    // Lock rows in a deterministic order (sorted by id) to avoid deadlocks
    // when two requests try to hold overlapping sets of seats in different
    // orders — classic transaction-deadlock-prevention technique.
    const sortedIds = [...eventSeatIds].sort();

    const { rows } = await client.query<EventSeat>(
      `SELECT * FROM event_seats WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE`,
      [sortedIds]
    );

    if (rows.length !== sortedIds.length) {
      throw new NotFoundError('One or more seats do not exist for this event');
    }

    const now = new Date();
    const unavailable = rows.filter((seat) => {
      if (seat.status === 'BOOKED') return true;
      if (seat.status === 'HELD' && seat.held_by !== userId) {
        // still actively held by someone else?
        if (seat.held_until && new Date(seat.held_until) > now) return true;
      }
      return false;
    });

    if (unavailable.length > 0) {
      throw new SeatUnavailableError(unavailable.map((s) => s.id));
    }

    const heldUntil = new Date(now.getTime() + HOLD_DURATION_SECONDS * 1000);

    const updated: EventSeat[] = [];
    for (const seat of rows) {
      const { rows: updatedRows } = await client.query<EventSeat>(
        `UPDATE event_seats
         SET status = 'HELD', held_by = $1, held_until = $2, version = version + 1, updated_at = now()
         WHERE id = $3
         RETURNING *`,
        [userId, heldUntil, seat.id]
      );
      updated.push(updatedRows[0]);

      await client.query(
        `INSERT INTO seat_audit_log (id, event_seat_id, user_id, from_status, to_status, reason)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [uuidv4(), seat.id, userId, seat.status, 'HELD', 'USER_HOLD_REQUEST']
      );
    }

    // Set Redis TTL keys AFTER the DB transaction's writes are staged.
    // If Redis fails here, we don't fail the whole hold — Postgres is
    // still correct; we just log it. The reconciliation job (see
    // jobs/releaseExpiredHolds.ts) will catch any orphaned HELD seats
    // whose held_until has passed even without a Redis key.
    try {
      const pipeline = redis.pipeline();
      for (const seat of updated) {
        pipeline.set(holdKey(seat.id), userId, 'EX', HOLD_DURATION_SECONDS);
      }
      await pipeline.exec();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Redis hold-key write failed (non-fatal, Postgres is source of truth):', err);
    }

    return updated;
  });
}

/**
 * Confirms previously-held seats as BOOKED. Called after payment succeeds.
 * Re-validates ownership and expiry inside the same locked transaction —
 * never trust that the hold is still valid just because it was valid when
 * the user started checkout.
 */
export async function confirmSeats(
  eventSeatIds: string[],
  userId: string,
  client: PoolClient
): Promise<EventSeat[]> {
  const sortedIds = [...eventSeatIds].sort();
  const { rows } = await client.query<EventSeat>(
    `SELECT * FROM event_seats WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE`,
    [sortedIds]
  );

  const now = new Date();
  const invalid = rows.filter(
    (s) =>
      s.status !== 'HELD' ||
      s.held_by !== userId ||
      !s.held_until ||
      new Date(s.held_until) <= now
  );

  if (invalid.length > 0) {
    throw new SeatUnavailableError(invalid.map((s) => s.id));
  }

  const confirmed: EventSeat[] = [];
  for (const seat of rows) {
    const { rows: updatedRows } = await client.query<EventSeat>(
      `UPDATE event_seats
       SET status = 'BOOKED', held_until = NULL, version = version + 1, updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [seat.id]
    );
    confirmed.push(updatedRows[0]);

    await client.query(
      `INSERT INTO seat_audit_log (id, event_seat_id, user_id, from_status, to_status, reason)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [uuidv4(), seat.id, userId, 'HELD', 'BOOKED', 'PAYMENT_CONFIRMED']
    );

    try {
      await redis.del(holdKey(seat.id));
    } catch {
      /* non-fatal */
    }
  }

  return confirmed;
}

/**
 * Releases held seats back to AVAILABLE — used on explicit cancel,
 * payment failure, or hold expiry.
 */
export async function releaseSeats(
  eventSeatIds: string[],
  reason: string,
  userId?: string
): Promise<void> {
  if (eventSeatIds.length === 0) return;

  await withTransaction(async (client) => {
    const sortedIds = [...eventSeatIds].sort();
    const { rows } = await client.query<EventSeat>(
      `SELECT * FROM event_seats WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE`,
      [sortedIds]
    );

    for (const seat of rows) {
      if (seat.status === 'BOOKED') continue; // never auto-release a booked seat

      await client.query(
        `UPDATE event_seats
         SET status = 'AVAILABLE', held_by = NULL, held_until = NULL, version = version + 1, updated_at = now()
         WHERE id = $1`,
        [seat.id]
      );

      await client.query(
        `INSERT INTO seat_audit_log (id, event_seat_id, user_id, from_status, to_status, reason)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [uuidv4(), seat.id, userId || null, seat.status, 'AVAILABLE', reason]
      );

      try {
        await redis.del(holdKey(seat.id));
      } catch {
        /* non-fatal */
      }
    }
  });
}

/**
 * Reconciliation sweep: finds seats stuck in HELD state whose hold has
 * expired (held_until < now) and releases them. This is the safety net
 * that runs even if Redis TTL events are missed or Redis was down —
 * Postgres timestamps are the ultimate source of truth for expiry too.
 * Scheduled via node-cron in jobs/releaseExpiredHolds.ts.
 */
export async function releaseAllExpiredHolds(): Promise<number> {
  const result = await withTransaction(async (client) => {
    const { rows } = await client.query<EventSeat>(
      `SELECT id FROM event_seats
       WHERE status = 'HELD' AND held_until IS NOT NULL AND held_until < now()
       FOR UPDATE SKIP LOCKED`
    );

    for (const seat of rows) {
      await client.query(
        `UPDATE event_seats
         SET status = 'AVAILABLE', held_by = NULL, held_until = NULL, version = version + 1, updated_at = now()
         WHERE id = $1`,
        [seat.id]
      );
      await client.query(
        `INSERT INTO seat_audit_log (id, event_seat_id, from_status, to_status, reason)
         VALUES ($1, $2, $3, $4, $5)`,
        [uuidv4(), seat.id, 'HELD', 'AVAILABLE', 'HOLD_EXPIRED_SWEEP']
      );
    }
    return rows.length;
  });

  return result;
}
