export type UserRole = 'USER' | 'ADMIN' | 'ORGANIZER';

export interface User {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  created_at: Date;
  updated_at: Date;
}

export type EventStatus = 'DRAFT' | 'PUBLISHED' | 'CANCELLED' | 'COMPLETED';
export type EventCategory =
  | 'CONCERT'
  | 'MOVIE'
  | 'SPORTS'
  | 'CONFERENCE'
  | 'TRAVEL'
  | 'THEATRE'
  | 'GENERAL';

export interface EventRecord {
  id: string;
  title: string;
  description: string | null;
  category: EventCategory;
  venue_id: string;
  organizer_id: string;
  starts_at: Date;
  ends_at: Date;
  status: EventStatus;
  base_price: string;
  cover_image_url: string | null;
  created_at: Date;
  updated_at: Date;
}

export type EventSeatStatus = 'AVAILABLE' | 'HELD' | 'BOOKED';

export interface EventSeat {
  id: string;
  event_id: string;
  seat_id: string;
  price: string;
  status: EventSeatStatus;
  held_by: string | null;
  held_until: Date | null;
  version: number;
  updated_at: Date;
  // joined fields (from `seats` table), present when selected with a join
  section?: string;
  row_label?: string;
  seat_number?: number;
  seat_type?: string;
}

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED' | 'FAILED';

export interface Booking {
  id: string;
  booking_ref: string;
  user_id: string;
  event_id: string;
  status: BookingStatus;
  total_amount: string;
  payment_id: string | null;
  created_at: Date;
  confirmed_at: Date | null;
  cancelled_at: Date | null;
}

export interface JwtPayload {
  userId: string;
  role: UserRole;
  email: string;
}

// Augment Express Request with our auth payload
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
