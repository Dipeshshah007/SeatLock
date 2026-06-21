import dotenv from 'dotenv';
dotenv.config();

import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { pool, query } from '../../config/db';

async function seed(): Promise<void> {
  console.log('🌱 Seeding database...');

  const passwordHash = await bcrypt.hash('Password123!', 10);

  // ── Users ───────────────────────────────────────────────
  const adminId = uuidv4();
  const organizerId = uuidv4();
  const userId = uuidv4();

  await query(
    `INSERT INTO users (id, name, email, password_hash, role) VALUES
     ($1, 'Admin User', 'admin@seatlock.app', $4, 'ADMIN'),
     ($2, 'Olivia Organizer', 'organizer@seatlock.app', $4, 'ORGANIZER'),
     ($3, 'Sam Customer', 'user@seatlock.app', $4, 'USER')
     ON CONFLICT (email) DO NOTHING`,
    [adminId, organizerId, userId, passwordHash]
  );

  // ── Venues ──────────────────────────────────────────────
  const venue1 = uuidv4();
  const venue2 = uuidv4();

  await query(
    `INSERT INTO venues (id, name, address, city, country) VALUES
     ($1, 'Grand Arena', '123 Main St', 'New York', 'USA'),
     ($2, 'Skyline Convention Center', '456 Tech Ave', 'San Francisco', 'USA')
     ON CONFLICT DO NOTHING`,
    [venue1, venue2]
  );

  // ── Events + seat inventory ─────────────────────────────
  const events = [
    {
      title: 'Neon Nights — Live Concert',
      category: 'CONCERT',
      venue: venue1,
      basePrice: 49.99,
      daysFromNow: 14,
      durationHrs: 3,
      cover: 'https://images.unsplash.com/photo-1493676304819-0d7a8d026dcf?w=800',
      layout: [
        { section: 'VIP', rowLabel: 'A', seatCount: 20, seatType: 'VIP', price: 149.99 },
        { section: 'General', rowLabel: 'B', seatCount: 40, seatType: 'STANDARD', price: 49.99 },
        { section: 'General', rowLabel: 'C', seatCount: 40, seatType: 'STANDARD', price: 49.99 },
      ],
    },
    {
      title: 'TechConf 2026 — Future of AI',
      category: 'CONFERENCE',
      venue: venue2,
      basePrice: 199,
      daysFromNow: 30,
      durationHrs: 8,
      cover: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800',
      layout: [
        { section: 'Front', rowLabel: 'A', seatCount: 15, seatType: 'VIP', price: 349 },
        { section: 'Main', rowLabel: 'B', seatCount: 50, seatType: 'STANDARD', price: 199 },
      ],
    },
    {
      title: 'City Finals — Basketball Championship',
      category: 'SPORTS',
      venue: venue1,
      basePrice: 35,
      daysFromNow: 7,
      durationHrs: 2,
      cover: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800',
      layout: [
        { section: 'Courtside', rowLabel: 'A', seatCount: 10, seatType: 'VIP', price: 299 },
        { section: 'Lower Bowl', rowLabel: 'B', seatCount: 60, seatType: 'STANDARD', price: 35 },
      ],
    },
  ];

  for (const evt of events) {
    const eventId = uuidv4();
    const startsAt = new Date(Date.now() + evt.daysFromNow * 86400000);
    const endsAt = new Date(startsAt.getTime() + evt.durationHrs * 3600000);

    await query(
      `INSERT INTO events (id, title, description, category, venue_id, organizer_id, starts_at, ends_at, base_price, cover_image_url, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'PUBLISHED')`,
      [
        eventId,
        evt.title,
        `Don't miss ${evt.title} — an unforgettable experience.`,
        evt.category,
        evt.venue,
        organizerId,
        startsAt.toISOString(),
        endsAt.toISOString(),
        evt.basePrice,
        evt.cover,
      ]
    );

    for (const section of evt.layout) {
      for (let n = 1; n <= section.seatCount; n++) {
        const seatId = uuidv4();
        await query(
          `INSERT INTO seats (id, venue_id, section, row_label, seat_number, seat_type)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (venue_id, section, row_label, seat_number) DO UPDATE SET seat_type = EXCLUDED.seat_type
           RETURNING id`,
          [seatId, evt.venue, section.section, section.rowLabel, n, section.seatType]
        );
        await query(
          `INSERT INTO event_seats (id, event_id, seat_id, price, status)
           VALUES ($1, $2, $3, $4, 'AVAILABLE')`,
          [uuidv4(), eventId, seatId, section.price]
        );
      }
    }

    console.log(`  ✓ Created event: ${evt.title}`);
  }

  console.log('\n✅ Seed complete!\n');
  console.log('Demo accounts (all use password: Password123!):');
  console.log('  Admin:     admin@seatlock.app');
  console.log('  Organizer: organizer@seatlock.app');
  console.log('  User:      user@seatlock.app\n');

  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
