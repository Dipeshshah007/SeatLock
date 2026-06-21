/* eslint-disable @typescript-eslint/no-explicit-any */
import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createExtension('pgcrypto', { ifNotExists: true });

  // ─────────────────────────────────────────────────────────────
  // USERS
  // ─────────────────────────────────────────────────────────────
  pgm.createTable('users', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    name: { type: 'varchar(120)', notNull: true },
    email: { type: 'varchar(255)', notNull: true, unique: true },
    password_hash: { type: 'text', notNull: true },
    role: { type: 'varchar(20)', notNull: true, default: 'USER' }, // USER | ADMIN | ORGANIZER
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint('users', 'users_role_check', "CHECK (role IN ('USER', 'ADMIN', 'ORGANIZER'))");

  // ─────────────────────────────────────────────────────────────
  // VENUES — generic enough for concerts, sports, conferences, flights/buses (seat-based) etc.
  // ─────────────────────────────────────────────────────────────
  pgm.createTable('venues', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    name: { type: 'varchar(200)', notNull: true },
    address: { type: 'text' },
    city: { type: 'varchar(100)' },
    country: { type: 'varchar(100)' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  // ─────────────────────────────────────────────────────────────
  // EVENTS — the generic "thing being booked". Works for concerts, movies,
  // flights, conferences, sports, theatre — anything with a seat map + time slot.
  // ─────────────────────────────────────────────────────────────
  pgm.createTable('events', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    title: { type: 'varchar(200)', notNull: true },
    description: { type: 'text' },
    category: { type: 'varchar(50)', notNull: true, default: 'GENERAL' }, // CONCERT|MOVIE|SPORTS|CONFERENCE|TRAVEL|THEATRE|GENERAL
    venue_id: { type: 'uuid', notNull: true, references: 'venues', onDelete: 'CASCADE' },
    organizer_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'CASCADE' },
    starts_at: { type: 'timestamptz', notNull: true },
    ends_at: { type: 'timestamptz', notNull: true },
    status: { type: 'varchar(20)', notNull: true, default: 'PUBLISHED' }, // DRAFT|PUBLISHED|CANCELLED|COMPLETED
    base_price: { type: 'numeric(10,2)', notNull: true, default: 0 },
    cover_image_url: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint(
    'events',
    'events_status_check',
    "CHECK (status IN ('DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED'))"
  );
  pgm.createIndex('events', 'venue_id');
  pgm.createIndex('events', 'organizer_id');
  pgm.createIndex('events', 'status');
  pgm.createIndex('events', 'starts_at');

  // ─────────────────────────────────────────────────────────────
  // SEATS — belong to a venue's physical layout (section/row/number),
  // but availability is tracked PER EVENT via event_seats below.
  // This lets the same physical venue host many events independently.
  // ─────────────────────────────────────────────────────────────
  pgm.createTable('seats', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    venue_id: { type: 'uuid', notNull: true, references: 'venues', onDelete: 'CASCADE' },
    section: { type: 'varchar(50)', notNull: true, default: 'GENERAL' },
    row_label: { type: 'varchar(10)', notNull: true, default: 'A' },
    seat_number: { type: 'integer', notNull: true },
    seat_type: { type: 'varchar(20)', notNull: true, default: 'STANDARD' }, // STANDARD|VIP|ACCESSIBLE
  });
  pgm.addConstraint(
    'seats',
    'seats_unique_position',
    'UNIQUE (venue_id, section, row_label, seat_number)'
  );
  pgm.createIndex('seats', 'venue_id');

  // ─────────────────────────────────────────────────────────────
  // EVENT_SEATS — THE CRITICAL TABLE for concurrency safety.
  // One row per (event, seat). `status` + `version` is what we lock on.
  // status: AVAILABLE -> HELD -> BOOKED (or back to AVAILABLE on expiry/cancel)
  // `version` is used for optimistic-lock sanity checks on top of the
  // pessimistic row lock (SELECT ... FOR UPDATE) taken in the booking service.
  // ─────────────────────────────────────────────────────────────
  pgm.createTable('event_seats', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    event_id: { type: 'uuid', notNull: true, references: 'events', onDelete: 'CASCADE' },
    seat_id: { type: 'uuid', notNull: true, references: 'seats', onDelete: 'CASCADE' },
    price: { type: 'numeric(10,2)', notNull: true },
    status: { type: 'varchar(20)', notNull: true, default: 'AVAILABLE' }, // AVAILABLE|HELD|BOOKED
    held_by: { type: 'uuid', references: 'users', onDelete: 'SET NULL' },
    held_until: { type: 'timestamptz' },
    version: { type: 'integer', notNull: true, default: 0 },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint(
    'event_seats',
    'event_seats_status_check',
    "CHECK (status IN ('AVAILABLE', 'HELD', 'BOOKED'))"
  );
  // This is what makes "double booking" structurally impossible at the DB level:
  // one (event_id, seat_id) pair can only ever exist once.
  pgm.addConstraint('event_seats', 'event_seats_unique_event_seat', 'UNIQUE (event_id, seat_id)');
  pgm.createIndex('event_seats', 'event_id');
  pgm.createIndex('event_seats', ['event_id', 'status']);
  pgm.createIndex('event_seats', 'held_until');

  // ─────────────────────────────────────────────────────────────
  // BOOKINGS — a checkout transaction; can cover multiple seats.
  // ─────────────────────────────────────────────────────────────
  pgm.createTable('bookings', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    booking_ref: { type: 'varchar(20)', notNull: true, unique: true },
    user_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'CASCADE' },
    event_id: { type: 'uuid', notNull: true, references: 'events', onDelete: 'CASCADE' },
    status: { type: 'varchar(20)', notNull: true, default: 'PENDING' }, // PENDING|CONFIRMED|CANCELLED|EXPIRED|FAILED
    total_amount: { type: 'numeric(10,2)', notNull: true },
    payment_id: { type: 'uuid' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    confirmed_at: { type: 'timestamptz' },
    cancelled_at: { type: 'timestamptz' },
  });
  pgm.addConstraint(
    'bookings',
    'bookings_status_check',
    "CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED', 'FAILED'))"
  );
  pgm.createIndex('bookings', 'user_id');
  pgm.createIndex('bookings', 'event_id');
  pgm.createIndex('bookings', 'status');

  // ─────────────────────────────────────────────────────────────
  // BOOKING_SEATS — join table: which event_seats belong to which booking
  // ─────────────────────────────────────────────────────────────
  pgm.createTable('booking_seats', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    booking_id: { type: 'uuid', notNull: true, references: 'bookings', onDelete: 'CASCADE' },
    event_seat_id: { type: 'uuid', notNull: true, references: 'event_seats', onDelete: 'CASCADE' },
    price: { type: 'numeric(10,2)', notNull: true },
  });
  pgm.addConstraint('booking_seats', 'booking_seats_unique', 'UNIQUE (booking_id, event_seat_id)');
  pgm.createIndex('booking_seats', 'booking_id');

  // ─────────────────────────────────────────────────────────────
  // PAYMENTS — mocked gateway, but modeled like a real one (idempotency key etc.)
  // ─────────────────────────────────────────────────────────────
  pgm.createTable('payments', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    booking_id: { type: 'uuid', notNull: true, references: 'bookings', onDelete: 'CASCADE' },
    idempotency_key: { type: 'varchar(100)', notNull: true, unique: true },
    amount: { type: 'numeric(10,2)', notNull: true },
    status: { type: 'varchar(20)', notNull: true, default: 'INITIATED' }, // INITIATED|SUCCESS|FAILED
    provider: { type: 'varchar(50)', notNull: true, default: 'MOCK_GATEWAY' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint(
    'payments',
    'payments_status_check',
    "CHECK (status IN ('INITIATED', 'SUCCESS', 'FAILED'))"
  );
  pgm.createIndex('payments', 'booking_id');

  // ─────────────────────────────────────────────────────────────
  // AUDIT LOG — every seat state transition, for debugging race conditions
  // and demonstrating system observability (great talking point in interviews)
  // ─────────────────────────────────────────────────────────────
  pgm.createTable('seat_audit_log', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    event_seat_id: { type: 'uuid', notNull: true, references: 'event_seats', onDelete: 'CASCADE' },
    user_id: { type: 'uuid', references: 'users', onDelete: 'SET NULL' },
    from_status: { type: 'varchar(20)' },
    to_status: { type: 'varchar(20)', notNull: true },
    reason: { type: 'varchar(100)' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('seat_audit_log', 'event_seat_id');
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('seat_audit_log');
  pgm.dropTable('payments');
  pgm.dropTable('booking_seats');
  pgm.dropTable('bookings');
  pgm.dropTable('event_seats');
  pgm.dropTable('seats');
  pgm.dropTable('events');
  pgm.dropTable('venues');
  pgm.dropTable('users');
}
