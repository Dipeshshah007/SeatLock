import { api } from './client';
import type {
  Booking,
  EventDetail,
  EventSummary,
  SeatMapEntry,
  User,
  Venue,
} from '../types';

// ── Auth ─────────────────────────────────────────────────
export const authApi = {
  register: (data: { name: string; email: string; password: string }) =>
    api.post<{ user: User; token: string }>('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post<{ user: User; token: string }>('/auth/login', data),
  me: () => api.get<{ user: User }>('/auth/me'),
};

// ── Events ───────────────────────────────────────────────
export interface EventFilters {
  category?: string;
  city?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const eventsApi = {
  list: (filters: EventFilters = {}) =>
    api.get<{
      events: EventSummary[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>('/events', { params: filters }),
  get: (id: string) =>
    api.get<{ event: EventDetail; seatMap: SeatMapEntry[] }>(`/events/${id}`),
  create: (data: unknown) => api.post('/events', data),
  cancel: (id: string) => api.patch(`/events/${id}/cancel`),
};

// ── Seats ────────────────────────────────────────────────
export const seatsApi = {
  hold: (eventSeatIds: string[]) =>
    api.post<{ heldSeats: SeatMapEntry[]; holdDurationSeconds: number }>('/seats/hold', {
      eventSeatIds,
    }),
  release: (eventSeatIds: string[]) => api.post('/seats/release', { eventSeatIds }),
};

// ── Bookings ─────────────────────────────────────────────
export const bookingsApi = {
  create: (eventId: string, eventSeatIds: string[]) =>
    api.post<{ booking: Booking }>('/bookings', { eventId, eventSeatIds }),
  checkout: (bookingId: string, idempotencyKey: string) =>
    api.post<{ booking: Booking }>(`/bookings/${bookingId}/checkout`, { idempotencyKey }),
  cancel: (bookingId: string) => api.post<{ booking: Booking }>(`/bookings/${bookingId}/cancel`),
  get: (bookingId: string) => api.get(`/bookings/${bookingId}`),
  myBookings: () => api.get<{ bookings: Booking[] }>('/bookings/my'),
};

// ── Venues ───────────────────────────────────────────────
export const venuesApi = {
  list: () => api.get<{ venues: Venue[] }>('/venues'),
  create: (data: { name: string; address?: string; city?: string; country?: string }) =>
    api.post<{ venue: Venue }>('/venues', data),
};

// ── Admin ────────────────────────────────────────────────
export const adminApi = {
  stats: () => api.get('/admin/stats'),
};
