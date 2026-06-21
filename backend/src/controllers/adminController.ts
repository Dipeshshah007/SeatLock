import { Request, Response } from 'express';
import { query } from '../config/db';
import { asyncHandler } from '../middleware/errorHandler';

/**
 * GET /api/admin/stats
 * Lightweight aggregate dashboard — total revenue, bookings, top events.
 * Demonstrates SQL aggregation skills, not just CRUD.
 */
export const dashboardStats = asyncHandler(async (_req: Request, res: Response) => {
  const [revenue, bookingCounts, topEvents, seatUtilization] = await Promise.all([
    query(
      `SELECT COALESCE(SUM(total_amount), 0) as total_revenue
       FROM bookings WHERE status = 'CONFIRMED'`
    ),
    query(
      `SELECT status, COUNT(*) as count FROM bookings GROUP BY status`
    ),
    query(
      `SELECT e.id, e.title, COUNT(bs.id) as seats_sold, COALESCE(SUM(bs.price), 0) as revenue
       FROM events e
       JOIN bookings b ON b.event_id = e.id AND b.status = 'CONFIRMED'
       JOIN booking_seats bs ON bs.booking_id = b.id
       GROUP BY e.id, e.title
       ORDER BY revenue DESC
       LIMIT 5`
    ),
    query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'AVAILABLE') as available,
         COUNT(*) FILTER (WHERE status = 'HELD') as held,
         COUNT(*) FILTER (WHERE status = 'BOOKED') as booked
       FROM event_seats`
    ),
  ]);

  res.json({
    totalRevenue: revenue.rows[0].total_revenue,
    bookingsByStatus: bookingCounts.rows,
    topEvents: topEvents.rows,
    seatUtilization: seatUtilization.rows[0],
  });
});
