# 🎟️ SeatLock — Event Ticketing with Concurrency-Safe Seat Booking

A full-stack ticketing platform where two people can never accidentally book the same seat — even if they click "Book" in the exact same millisecond.

## 1. The Problem

Any system that sells a **limited, identifiable inventory** to many simultaneous users faces the same hard problem: **the race condition**.

Picture a popular concert. The moment tickets go live, hundreds of people hit "Book seat A12" within the same second. A naively-built system does roughly this:

## 2. Our Solution

SeatLock solves this with **two complementary concurrency-control layers**, each chosen because it's good at something the other isn't:

| Layer | Mechanism | What it guarantees |
|---|---|---|
| **PostgreSQL** | `SELECT ... FOR UPDATE` row-level locking inside ACID transactions, plus a `UNIQUE(event_id, seat_id)` constraint | **Correctness.** It is *structurally impossible* for two transactions to simultaneously hold/confirm the same seat — the second transaction blocks until the first commits or rolls back. This is the actual source of truth. |
| **Redis** | TTL key (`seat-hold:<id>`, 5-minute expiry) set alongside every Postgres hold | **Fast, cheap "soft hold" UX** — lets the frontend show a live countdown without expensive timestamp scans on every page load. If Redis goes down, Postgres still enforces correctness; we just temporarily lose the nice countdown. |
| **Cron sweep job** | Runs every 30s, uses `SELECT ... FOR UPDATE SKIP LOCKED` | **Safety net.** Catches any seat stuck in `HELD` whose hold expired — even if Redis missed an event or the app crashed mid-checkout. |

We deliberately **never trust Redis as the only source of truth for money-related state** — a classic distributed-systems mistake. Postgres transactions are the real guarantee; Redis is a performance/UX optimization layered on top.

The full seat lifecycle

## 3. Who Uses This:

SeatLock's data model is intentionally **generic** — an `event` has a `venue`, a seat layout, and a time slot. This isn't hardcoded to concerts. The same engine works for:

| User type | What they do |
|---|---|
| **Guests / Customers** | Browse events without an account; register/log in; select seats on a live map; check out; view booking history; cancel bookings |
| **Organizers** | Create events (concerts, conferences, sports, theatre, travel...) with a custom seat layout (sections × rows × seat counts), set per-section pricing, cancel events |
| **Admins** | Everything organizers can do, plus a revenue/bookings dashboard, manual hold-sweep trigger, full system oversight |

Because the `category` field is just an enum (`CONCERT`, `SPORTS`, `CONFERENCE`, `TRAVEL`, `THEATRE`, `MOVIE`, `GENERAL`) and seat layouts are declarative, **the exact same codebase could power a movie theatre chain, a flight-seat-selector, or a conference registration system** with zero schema changes — only different seed data. This reusability is a deliberate design decision worth highlighting in interviews.

## 4. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React 19 + TypeScript + Vite | Fast dev server, huge ecosystem, what most companies use day-to-day |
| Backend | Node.js + Express + TypeScript | Same language as the frontend (one mental model), huge job-market relevance |
| Database | PostgreSQL 16 | ACID transactions + row-level locking are exactly what concurrency-safety needs |
| Cache / Locks | Redis 7 | Industry-standard for TTL-based holds and fast ephemeral state |
| Auth | JWT (jsonwebtoken) + bcrypt | Stateless, simple, standard |
| Validation | Zod | Type-safe runtime validation, shared mental model with TypeScript |
| Testing | Jest + Supertest | Standard Node testing stack; includes a **real concurrency test** (see §11) |
| Dev environment | Docker Compose (Postgres + Redis only) | Zero manual DB installs — works identically on Windows/Mac/Linux |
| IDE | VS Code | As requested — every recommended extension is free |

## 5. Setup Instructions (Step by Step)

### Prerequisites (all free)
- Node.js 20+ (LTS) — https://nodejs.org
- Docker Desktop (for Postgres + Redis — no manual DB install needed) — https://www.docker.com/products/docker-desktop/
- Git — https://git-scm.com/

### Step 1 — Clone and install
```bash
git clone <your-repo-url> seatlock
cd seatlock
npm run install:all
```
This installs dependencies for both `backend/` and `frontend/`.

### Step 2 — Start Postgres + Redis with Docker
```bash
npm run docker:up
```
This starts two containers (Postgres on `5432`, Redis on `6379`) with persistent volumes. Verify they're healthy:
```bash
docker compose ps
```
> **No Docker?** You can instead install Postgres 16 and Redis locally and update the connection strings in `backend/.env` — but Docker is strongly recommended since it requires zero configuration.

### Step 3 — Configure environment variables
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```
The defaults in `.env.example` already match the Docker Compose credentials, so **no editing is required** to get started. (Do change `JWT_SECRET` before any real deployment.)

### Step 4 — Run database migrations
```bash
npm run migrate
```
This creates all tables (`users`, `venues`, `events`, `seats`, `event_seats`, `bookings`, `booking_seats`, `payments`, `seat_audit_log`).

### Step 5 — Seed demo data
```bash
npm run seed
```
This creates 3 demo accounts (admin/organizer/user) and 3 demo events (concert, conference, sports) with full seat maps, ready to browse and book immediately.

### Step 6 — Run the app
```bash
npm run dev
```
This starts **both** the backend (`http://localhost:4000`) and frontend (`http://localhost:5173`) concurrently with hot-reload, using `concurrently`.

Open **http://localhost:5173** in your browser. 🎉

### Step 7 — Open in VS Code
```bash
code .
```
On first open, VS Code will prompt you to install the recommended extensions (ESLint, Prettier, Docker, PostgreSQL client, Thunder Client for API testing) — accept this, all are free.

### Running things individually (optional)
```bash
npm run dev:backend     # backend only, with hot reload
npm run dev:frontend    # frontend only, with hot reload
npm run test:backend    # run the Jest test suite (includes the concurrency test!)
npm run docker:logs     # tail Postgres/Redis container logs
npm run docker:down     # stop the containers
```

### One-command setup (alternative to steps 1–5)
```bash
npm run setup
```
Runs install → docker up → migrate → seed in sequence.

---
