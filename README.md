# 🎟️ SeatLock — Event Ticketing with Concurrency-Safe Seat Booking

A full-stack ticketing platform where two people can never accidentally book the same seat — even if they click "Book" in the exact same millisecond.

## 1. The Problem

Any system that sells a **limited, identifiable inventory** to many simultaneous users faces the same hard problem: **the race condition**.

Picture a popular concert. The moment tickets go live, hundreds of people hit "Book seat A12" within the same second. A naively-built system does roughly this:

## 2. My Solution

SeatLock solves this with **two complementary concurrency-control layers**, each chosen because it's good at something the other isn't:

| Layer | Mechanism | What it guarantees |
|---|---|---|
| **PostgreSQL** | `SELECT ... FOR UPDATE` row-level locking inside ACID transactions, plus a `UNIQUE(event_id, seat_id)` constraint | **Correctness.** It is *structurally impossible* for two transactions to simultaneously hold/confirm the same seat — the second transaction blocks until the first commits or rolls back. This is the actual source of truth. |
| **Redis** | TTL key (`seat-hold:<id>`, 5-minute expiry) set alongside every Postgres hold | **Fast, cheap "soft hold" UX** — lets the frontend show a live countdown without expensive timestamp scans on every page load. If Redis goes down, Postgres still enforces correctness; we just temporarily lose the nice countdown. |
| **Cron sweep job** | Runs every 30s, uses `SELECT ... FOR UPDATE SKIP LOCKED` | **Safety net.** Catches any seat stuck in `HELD` whose hold expired — even if Redis missed an event or the app crashed mid-checkout. |

## 3. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React 19 + TypeScript + Vite | Fast dev server, huge ecosystem |
| Backend | Node.js + Express + TypeScript | 
| Database | PostgreSQL 16 | ACID transactions + row-level locking are exactly what concurrency-safety needs |
| Cache / Locks | Redis 7 | Industry-standard for TTL-based holds and fast ephemeral state |
| Auth | JWT (jsonwebtoken) + bcrypt | Stateless, simple, standard |
| Validation | Zod | Type-safe runtime validation, shared mental model with TypeScript |
| Testing | Jest + Supertest | Standard Node testing stack, includes a **real concurrency test** (see §11) |
| Dev environment | Docker Compose (Postgres + Redis only) | Zero manual DB installs — works identically on Windows/Mac/Linux |
| IDE | VS Code 

## 4. Setup Instructions (Step by Step)

### Prerequisites
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

### Step 3 — Configure environment variables
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### Step 4 — Run database migrations
```bash
npm run migrate
```

### Step 5 — Seed demo data
```bash
npm run seed
```

### Step 6 — Run the app
```bash
npm run dev
```

