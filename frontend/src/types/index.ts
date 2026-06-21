export type UserRole = 'USER' | 'ADMIN' | 'ORGANIZER';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export type EventCategory =
  | 'CONCERT'
  | 'MOVIE'
  | 'SPORTS'
  | 'CONFERENCE'
  | 'TRAVEL'
  | 'THEATRE'
  | 'GENERAL';

export interface EventSummary {
  id: string;
  title: string;
  description: string | null;
  category: EventCategory;
  venue_name: string;
  venue_city: string;
  starts_at: string;
  ends_at: string;
  base_price: string;
  cover_image_url: string | null;
  seats_available: string;
  seats_total: string;
}

export interface EventDetail {
  id: string;
  title: string;
  description: string | null;
  category: EventCategory;
  starts_at: string;
  ends_at: string;
  base_price: string;
  cover_image_url: string | null;
  venue_name: string;
  venue_address: string | null;
  venue_city: string | null;
  venue_country: string | null;
}

export type EventSeatStatus = 'AVAILABLE' | 'HELD' | 'BOOKED';

export interface SeatMapEntry {
  id: string;
  price: string;
  status: EventSeatStatus;
  held_until: string | null;
  version: number;
  section: string;
  row_label: string;
  seat_number: number;
  seat_type: 'STANDARD' | 'VIP' | 'ACCESSIBLE';
}

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED' | 'FAILED';

export interface Booking {
  id: string;
  booking_ref: string;
  user_id: string;
  event_id: string;
  status: BookingStatus;
  total_amount: string;
  created_at: string;
  confirmed_at: string | null;
  cancelled_at: string | null;
  event_title?: string;
  starts_at?: string;
  venue_name?: string;
  cover_image_url?: string;
}

export interface Venue {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  country: string | null;
}
