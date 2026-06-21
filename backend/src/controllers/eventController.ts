import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from '../config/db';
import { asyncHandler } from '../middleware/errorHandler';
import { createEventSchema } from '../utils/validators';
import { NotFoundError, ForbiddenError } from '../utils/errors';
import { releaseAllExpiredHolds } from '../services/seatLockService';

/**
 * GET /api/events
 * Public browse endpoint with optional filters: category, city, search, date range.
 * This generic filtering is what makes the catalog reusable for ANY event type.
 */
export const listEvents = asyncHandler(async (req: Request, res: Response) => {
  const { category, city, search, from, to, page = '1', limit = '12' } = req.query;

  const conditions: string[] = [`e.status = 'PUBLISHED'`];
  const params: unknown[] = [];

  if (category) {
    params.push(category);
    conditions.push(`e.category = $${params.length}`);
  }
  if (city) {
    params.push(`%${city}%`);
    conditions.push(`v.city ILIKE $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(e.title ILIKE $${params.length} OR e.description ILIKE $${params.length})`);
  }
  if (from) {
    params.push(from);
    conditions.push(`e.starts_at >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    conditions.push(`e.starts_at <= $${params.length}`);
  }

  const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10) || 12));
  const offset = (pageNum - 1) * limitNum;

  const whereClause = conditions.join(' AND ');

  const { rows } = await query(
    `SELECT e.*, v.name as venue_name, v.city as venue_city,
            (SELECT COUNT(*) FROM event_seats es WHERE es.event_id = e.id AND es.status = 'AVAILABLE') as seats_available,
            (SELECT COUNT(*) FROM event_seats es WHERE es.event_id = e.id) as seats_total
     FROM events e
     JOIN venues v ON v.id = e.venue_id
     WHERE ${whereClause}
     ORDER BY e.starts_at ASC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limitNum, offset]
  );

  const { rows: countRows } = await query(
    `SELECT COUNT(*) as total FROM events e JOIN venues v ON v.id = e.venue_id WHERE ${whereClause}`,
    params
  );

  res.json({
    events: rows,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: parseInt(countRows[0].total, 10),
      totalPages: Math.ceil(parseInt(countRows[0].total, 10) / limitNum),
    },
  });
});

/**
 * GET /api/events/:id
 * Full event detail including the live seat map. This also opportunistically
 * sweeps expired holds for THIS event so a user browsing doesn't see stale
 * "HELD" seats that should actually be available again.
 */
export const getEvent = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const { rows: eventRows } = await query(
    `SELECT e.*, v.name as venue_name, v.address as venue_address, v.city as venue_city, v.country as venue_country
     FROM events e JOIN venues v ON v.id = e.venue_id WHERE e.id = $1`,
    [id]
  );
  if (eventRows.length === 0) throw new NotFoundError('Event not found');

  // lazy reconciliation: cheap, scoped sweep before reading seat map
  await query(
    `UPDATE event_seats SET status = 'AVAILABLE', held_by = NULL, held_until = NULL, version = version + 1, updated_at = now()
     WHERE event_id = $1 AND status = 'HELD' AND held_until < now()`,
    [id]
  );

  const { rows: seatRows } = await query(
    `SELECT es.id, es.price, es.status, es.held_until, es.version,
            s.section, s.row_label, s.seat_number, s.seat_type
     FROM event_seats es
     JOIN seats s ON s.id = es.seat_id
     WHERE es.event_id = $1
     ORDER BY s.section, s.row_label, s.seat_number`,
    [id]
  );

  res.json({ event: eventRows[0], seatMap: seatRows });
});

/**
 * POST /api/events
 * Organizer/Admin only. Creates an event AND auto-generates its seat
 * inventory from a declarative layout (sections x rows x seat counts),
 * so organizers don't have to manually create hundreds of seat rows.
 */
export const createEvent = asyncHandler(async (req: Request, res: Response) => {
  const data = createEventSchema.parse(req.body);
  const organizerId = req.user!.userId;

  const event = await withTransaction(async (client) => {
    const eventId = uuidv4();
    const { rows: eventRows } = await client.query(
      `INSERT INTO events (id, title, description, category, venue_id, organizer_id, starts_at, ends_at, base_price, cover_image_url, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'PUBLISHED')
       RETURNING *`,
      [
        eventId,
        data.title,
        data.description || null,
        data.category,
        data.venueId,
        organizerId,
        data.startsAt,
        data.endsAt,
        data.basePrice,
        data.coverImageUrl || null,
      ]
    );

    for (const layout of data.seatLayout) {
      for (let n = 1; n <= layout.seatCount; n++) {
        // find-or-create the physical seat in the venue
        const { rows: seatRows } = await client.query(
          `INSERT INTO seats (id, venue_id, section, row_label, seat_number, seat_type)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (venue_id, section, row_label, seat_number)
           DO UPDATE SET seat_type = EXCLUDED.seat_type
           RETURNING id`,
          [uuidv4(), data.venueId, layout.section, layout.rowLabel, n, layout.seatType]
        );
        const seatId = seatRows[0].id;

        const price =
          data.priceOverrides?.[layout.section] ??
          data.priceOverrides?.[layout.seatType] ??
          data.basePrice;

        await client.query(
          `INSERT INTO event_seats (id, event_id, seat_id, price, status)
           VALUES ($1, $2, $3, $4, 'AVAILABLE')`,
          [uuidv4(), eventId, seatId, price]
        );
      }
    }

    return eventRows[0];
  });

  res.status(201).json({ event });
});

export const cancelEvent = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { rows } = await query(`SELECT organizer_id FROM events WHERE id = $1`, [id]);
  if (rows.length === 0) throw new NotFoundError('Event not found');

  if (rows[0].organizer_id !== req.user!.userId && req.user!.role !== 'ADMIN') {
    throw new ForbiddenError('Only the organizer or an admin can cancel this event');
  }

  await query(`UPDATE events SET status = 'CANCELLED', updated_at = now() WHERE id = $1`, [id]);
  res.json({ message: 'Event cancelled' });
});

// Exposed for an admin "force sweep" button / manual trigger in the demo
export const triggerHoldSweep = asyncHandler(async (_req: Request, res: Response) => {
  const released = await releaseAllExpiredHolds();
  res.json({ releasedCount: released });
});
