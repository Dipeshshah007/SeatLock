import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(72),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createVenueSchema = z.object({
  name: z.string().min(2).max(200),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
});

export const seatLayoutSchema = z.object({
  section: z.string().min(1).max(50),
  rowLabel: z.string().min(1).max(10),
  seatCount: z.number().int().min(1).max(500),
  seatType: z.enum(['STANDARD', 'VIP', 'ACCESSIBLE']).default('STANDARD'),
});

export const createEventSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().optional(),
  category: z
    .enum(['CONCERT', 'MOVIE', 'SPORTS', 'CONFERENCE', 'TRAVEL', 'THEATRE', 'GENERAL'])
    .default('GENERAL'),
  venueId: z.string().uuid(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  basePrice: z.number().nonnegative(),
  coverImageUrl: z.string().url().optional(),
  seatLayout: z.array(seatLayoutSchema).min(1),
  // optional per-section price overrides, e.g. { VIP: 150 }
  priceOverrides: z.record(z.string(), z.number().nonnegative()).optional(),
});

export const holdSeatsSchema = z.object({
  eventSeatIds: z.array(z.string().uuid()).min(1).max(10),
});

export const createBookingSchema = z.object({
  eventId: z.string().uuid(),
  eventSeatIds: z.array(z.string().uuid()).min(1).max(10),
});

export const checkoutSchema = z.object({
  idempotencyKey: z.string().min(8).max(100),
});
