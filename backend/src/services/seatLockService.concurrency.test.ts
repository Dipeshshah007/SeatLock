import { v4 as uuidv4 } from 'uuid';
import { pool, query } from '../config/db';
import { redis } from '../config/redis';
import { holdSeats } from '../services/seatLockService';
import bcrypt from 'bcryptjs';

/**
 * ─────────────────────────────────────────────────────────────────────────
 * THE TEST THAT PROVES THE WHOLE PROJECT'S VALUE PROPOSITION
 * ─────────────────────────────────────────────────────────────────────────
 * We fire N concurrent "hold this same seat" requests at the service layer
 * — simulating N users clicking the same seat at the exact same instant —
 * and assert that EXACTLY ONE of them succeeds. This is what you screen-
 * record / screenshot for your portfolio and what you walk an interviewer
 * through line by line.
 *
 * Requires a real Postgres instance reachable via DATABASE_URL (see
 * docker-compose.yml). Run with: npm test
 * ─────────────────────────────────────────────────────────────────────────
 */

describe('Concurrency-safe seat holding', () => {
  let venueId: string;
  let eventId: string;
  let eventSeatId: string;
  const userIds: string[] = [];

  beforeAll(async () => {
    venueId = uuidv4();
    await query(`INSERT INTO venues (id, name) VALUES ($1, 'Test Venue')`, [venueId]);

    const organizerId = uuidv4();
    const passwordHash = await bcrypt.hash('test1234', 4);
    await query(
      `INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, 'Organizer', $2, $3, 'ORGANIZER')`,
      [organizerId, `organizer-${Date.now()}@test.com`, passwordHash]
    );

    eventId = uuidv4();
    await query(
      `INSERT INTO events (id, title, category, venue_id, organizer_id, starts_at, ends_at, base_price, status)
       VALUES ($1, 'Concurrency Test Event', 'GENERAL', $2, $3, now() + interval '1 day', now() + interval '2 days', 50, 'PUBLISHED')`,
      [eventId, venueId, organizerId]
    );

    const seatId = uuidv4();
    await query(
      `INSERT INTO seats (id, venue_id, section, row_label, seat_number) VALUES ($1, $2, 'A', 'A', 1)`,
      [seatId, venueId]
    );

    eventSeatId = uuidv4();
    await query(
      `INSERT INTO event_seats (id, event_id, seat_id, price, status) VALUES ($1, $2, $3, 50, 'AVAILABLE')`,
      [eventSeatId, eventId, seatId]
    );

    // 20 concurrent "users" all trying to grab the same seat
    for (let i = 0; i < 20; i++) {
      const uid = uuidv4();
      const ph = await bcrypt.hash('test1234', 4);
      await query(
        `INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, 'USER')`,
        [uid, `Test User ${i}`, `concurrent-user-${i}-${Date.now()}@test.com`, ph]
      );
      userIds.push(uid);
    }
  });

  afterAll(async () => {
    await query(`DELETE FROM events WHERE id = $1`, [eventId]);
    await query(`DELETE FROM venues WHERE id = $1`, [venueId]);
    for (const uid of userIds) {
      await query(`DELETE FROM users WHERE id = $1`, [uid]);
    }
    await pool.end();
    redis.disconnect();
  });

  it('allows exactly one of N concurrent hold requests to succeed for the same seat', async () => {
    const results = await Promise.allSettled(
      userIds.map((uid) => holdSeats([eventSeatId], uid))
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected');

    expect(succeeded.length).toBe(1);
    expect(failed.length).toBe(userIds.length - 1);

    // Verify final DB state matches: seat is HELD by exactly the one winner
    const { rows } = await query(
      `SELECT status, held_by FROM event_seats WHERE id = $1`,
      [eventSeatId]
    );
    expect(rows[0].status).toBe('HELD');
    expect(userIds).toContain(rows[0].held_by);
  });
});
