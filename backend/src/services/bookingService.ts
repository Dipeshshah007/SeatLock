import { v4 as uuidv4 } from 'uuid';
import { withTransaction } from '../config/db';
import { confirmSeats, releaseSeats } from './seatLockService';
import { NotFoundError, ConflictError } from '../utils/errors';
import { Booking, EventSeat } from '../types';
import { mockChargePayment } from './paymentService';
import { sendBookingConfirmationEmail } from './emailService';

function generateBookingRef(): string {
  // Human-friendly reference like SL-7K2P9Q
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let ref = 'SL-';
  for (let i = 0; i < 6; i++) ref += chars[Math.floor(Math.random() * chars.length)];
  return ref;
}

/**
 * Step 1 of checkout: create a PENDING booking row for seats the user has
 * already HELD (via seatLockService.holdSeats). This does not move money.
 */
export async function createPendingBooking(
  userId: string,
  eventId: string,
  eventSeatIds: string[]
): Promise<Booking> {
  return withTransaction(async (client) => {
    const { rows: seatRows } = await client.query<EventSeat>(
      `SELECT * FROM event_seats WHERE id = ANY($1::uuid[]) AND event_id = $2`,
      [eventSeatIds, eventId]
    );

    if (seatRows.length !== eventSeatIds.length) {
      throw new NotFoundError('Some seats do not belong to this event');
    }

    const now = new Date();
    const invalidHold = seatRows.find(
      (s) =>
        s.status !== 'HELD' ||
        s.held_by !== userId ||
        !s.held_until ||
        new Date(s.held_until) <= now
    );
    if (invalidHold) {
      throw new ConflictError('Your hold on one or more seats has expired. Please reselect seats.');
    }

    const totalAmount = seatRows.reduce((sum, s) => sum + parseFloat(s.price), 0);
    const bookingId = uuidv4();
    const bookingRef = generateBookingRef();

    const { rows: bookingRows } = await client.query<Booking>(
      `INSERT INTO bookings (id, booking_ref, user_id, event_id, status, total_amount)
       VALUES ($1, $2, $3, $4, 'PENDING', $5)
       RETURNING *`,
      [bookingId, bookingRef, userId, eventId, totalAmount.toFixed(2)]
    );

    for (const seat of seatRows) {
      await client.query(
        `INSERT INTO booking_seats (id, booking_id, event_seat_id, price)
         VALUES ($1, $2, $3, $4)`,
        [uuidv4(), bookingId, seat.id, seat.price]
      );
    }

    return bookingRows[0];
  });
}

/**
 * Step 2 of checkout: charge payment (mocked) and, on success, atomically
 * confirm the seats as BOOKED + flip booking to CONFIRMED. On payment
 * failure, the booking is marked FAILED and seats are released back to
 * AVAILABLE so other users aren't blocked by a failed payment forever.
 *
 * Uses an idempotency key so retried requests (e.g. user double-clicks
 * "Pay Now", or a flaky network causes a client-side retry) don't double
 * charge or double-confirm.
 */
export async function checkoutBooking(
  bookingId: string,
  userId: string,
  idempotencyKey: string
): Promise<Booking> {
  // Check idempotency first, outside the main transaction, for a fast path.
  const existingPayment = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT * FROM payments WHERE idempotency_key = $1`,
      [idempotencyKey]
    );
    return rows[0];
  });

  if (existingPayment && existingPayment.status === 'SUCCESS') {
    const { rows } = await withTransaction((client) =>
      client.query<Booking>(`SELECT * FROM bookings WHERE id = $1`, [bookingId])
    );
    return rows[0];
  }

  const { rows: bookingRows } = await withTransaction((client) =>
    client.query<Booking>(`SELECT * FROM bookings WHERE id = $1 AND user_id = $2`, [
      bookingId,
      userId,
    ])
  );
  const booking = bookingRows[0];
  if (!booking) throw new NotFoundError('Booking not found');
  if (booking.status === 'CONFIRMED') return booking;
  if (booking.status !== 'PENDING') {
    throw new ConflictError(`Booking is in ${booking.status} state and cannot be paid for`);
  }

  const { rows: seatLinkRows } = await withTransaction((client) =>
    client.query(`SELECT event_seat_id FROM booking_seats WHERE booking_id = $1`, [bookingId])
  );
  const eventSeatIds: string[] = seatLinkRows.map((r) => r.event_seat_id);

  // Charge payment OUTSIDE the DB lock — never hold row locks while waiting
  // on a slow external network call (this is a classic scalability mistake).
  const paymentResult = await mockChargePayment({
    amount: parseFloat(booking.total_amount),
    idempotencyKey,
  });

  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO payments (id, booking_id, idempotency_key, amount, status, provider)
       VALUES ($1, $2, $3, $4, $5, 'MOCK_GATEWAY')
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [uuidv4(), bookingId, idempotencyKey, booking.total_amount, paymentResult.status]
    );
  });

  if (!paymentResult.success) {
    await withTransaction((client) =>
      client.query(`UPDATE bookings SET status = 'FAILED' WHERE id = $1`, [bookingId])
    );
    await releaseSeats(eventSeatIds, 'PAYMENT_FAILED', userId);
    throw new ConflictError('Payment failed. Your seats have been released.');
  }

  const confirmedBooking = await withTransaction(async (client) => {
    await confirmSeats(eventSeatIds, userId, client);
    const { rows } = await client.query<Booking>(
      `UPDATE bookings SET status = 'CONFIRMED', confirmed_at = now() WHERE id = $1 RETURNING *`,
      [bookingId]
    );
    return rows[0];
  });

  // Fire-and-forget; email failure should never roll back a paid booking.
  sendBookingConfirmationEmail(userId, confirmedBooking).catch((err) =>
    // eslint-disable-next-line no-console
    console.error('Failed to send confirmation email:', err)
  );

  return confirmedBooking;
}

export async function cancelBooking(bookingId: string, userId: string): Promise<Booking> {
  const { rows: bookingRows } = await withTransaction((client) =>
    client.query<Booking>(`SELECT * FROM bookings WHERE id = $1 AND user_id = $2`, [
      bookingId,
      userId,
    ])
  );
  const booking = bookingRows[0];
  if (!booking) throw new NotFoundError('Booking not found');
  if (booking.status === 'CANCELLED') return booking;
  if (booking.status !== 'CONFIRMED' && booking.status !== 'PENDING') {
    throw new ConflictError(`Cannot cancel a booking in ${booking.status} state`);
  }

  const { rows: seatLinkRows } = await withTransaction((client) =>
    client.query(`SELECT event_seat_id FROM booking_seats WHERE booking_id = $1`, [bookingId])
  );
  const eventSeatIds: string[] = seatLinkRows.map((r) => r.event_seat_id);

  await releaseSeats(eventSeatIds, 'USER_CANCELLED', userId);

  const { rows } = await withTransaction((client) =>
    client.query<Booking>(
      `UPDATE bookings SET status = 'CANCELLED', cancelled_at = now() WHERE id = $1 RETURNING *`,
      [bookingId]
    )
  );
  return rows[0];
}
