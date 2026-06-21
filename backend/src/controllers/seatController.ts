import { Request, Response } from 'express';
import { holdSeatsSchema } from '../utils/validators';
import { holdSeats, releaseSeats } from '../services/seatLockService';
import { asyncHandler } from '../middleware/errorHandler';

/**
 * POST /api/seats/hold
 * Body: { eventSeatIds: string[] }
 * Places a temporary lock on seats for the authenticated user.
 * This is the endpoint the frontend calls the moment a user clicks
 * seats on the seat map, BEFORE they proceed to checkout.
 */
export const hold = asyncHandler(async (req: Request, res: Response) => {
  const { eventSeatIds } = holdSeatsSchema.parse(req.body);
  const userId = req.user!.userId;
  const heldSeats = await holdSeats(eventSeatIds, userId);
  res.json({ heldSeats, holdDurationSeconds: parseInt(process.env.SEAT_HOLD_DURATION_SECONDS || '300', 10) });
});

/**
 * POST /api/seats/release
 * Lets a user explicitly release seats they're no longer interested in
 * (e.g. they navigate away or deselect) instead of waiting for expiry —
 * good for UX and frees up inventory faster for other users.
 */
export const release = asyncHandler(async (req: Request, res: Response) => {
  const { eventSeatIds } = holdSeatsSchema.parse(req.body);
  const userId = req.user!.userId;
  await releaseSeats(eventSeatIds, 'USER_DESELECTED', userId);
  res.json({ message: 'Seats released' });
});
