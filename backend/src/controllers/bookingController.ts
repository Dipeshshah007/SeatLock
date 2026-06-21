import { Request, Response } from 'express';
import { query } from '../config/db';
import { asyncHandler } from '../middleware/errorHandler';
import { createBookingSchema, checkoutSchema } from '../utils/validators';
import { createPendingBooking, checkoutBooking, cancelBooking } from '../services/bookingService';
import { NotFoundError, ForbiddenError } from '../utils/errors';

export const createBooking = asyncHandler(async (req: Request, res: Response) => {
  const data = createBookingSchema.parse(req.body);
  const userId = req.user!.userId;
  const booking = await createPendingBooking(userId, data.eventId, data.eventSeatIds);
  res.status(201).json({ booking });
});

export const checkout = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const data = checkoutSchema.parse(req.body);
  const userId = req.user!.userId;
  const booking = await checkoutBooking(id, userId, data.idempotencyKey);
  res.json({ booking });
});

export const cancel = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.userId;
  const booking = await cancelBooking(id, userId);
  res.json({ booking });
});

export const getBooking = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.userId;

  const { rows } = await query(
    `SELECT b.*, e.title as event_title, e.starts_at, v.name as venue_name
     FROM bookings b
     JOIN events e ON e.id = b.event_id
     JOIN venues v ON v.id = e.venue_id
     WHERE b.id = $1`,
    [id]
  );
  if (rows.length === 0) throw new NotFoundError('Booking not found');
  const booking = rows[0];

  if (booking.user_id !== userId && req.user!.role !== 'ADMIN') {
    throw new ForbiddenError('You do not have access to this booking');
  }

  const { rows: seatRows } = await query(
    `SELECT bs.price, s.section, s.row_label, s.seat_number, s.seat_type
     FROM booking_seats bs
     JOIN event_seats es ON es.id = bs.event_seat_id
     JOIN seats s ON s.id = es.seat_id
     WHERE bs.booking_id = $1`,
    [id]
  );

  res.json({ booking, seats: seatRows });
});

export const myBookings = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { rows } = await query(
    `SELECT b.*, e.title as event_title, e.starts_at, e.cover_image_url, v.name as venue_name
     FROM bookings b
     JOIN events e ON e.id = b.event_id
     JOIN venues v ON v.id = e.venue_id
     WHERE b.user_id = $1
     ORDER BY b.created_at DESC`,
    [userId]
  );
  res.json({ bookings: rows });
});
