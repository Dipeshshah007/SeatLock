# Troubleshooting

Common issues when setting up SeatLock locally, and how to fix them.

## Docker

**`docker compose up` fails with "port already in use"**
Something else on your machine is already using port `5432` (Postgres) or `6379` (Redis) — commonly a previously-installed local Postgres/Redis. Either stop that service, or change the host port in `docker-compose.yml`:
```yaml
ports:
  - '5433:5432'   # use 5433 on your host instead
```
and update `DATABASE_URL` in `backend/.env` to match (`...@localhost:5433/seatlock`).

**`docker compose ps` shows containers as "unhealthy"**
Wait a few more seconds — Postgres can take 5-10 seconds to finish initializing on first run. Check logs with `npm run docker:logs`.

**"Cannot connect to the Docker daemon"**
Docker Desktop isn't running. Start it from your applications menu, wait for the whale icon to stop animating, then retry.

## Backend

**`npm run migrate` fails with a connection error**
- Confirm Docker containers are running: `docker compose ps`
- Confirm `backend/.env` exists (`cp backend/.env.example backend/.env`) and `DATABASE_URL` matches your Docker Compose credentials
- Try connecting manually to confirm: `docker exec -it seatlock-postgres psql -U seatlock -d seatlock -c "SELECT 1;"`

**`npm run seed` fails with "duplicate key value violates unique constraint"**
You've already seeded the database. This is safe to ignore (the seed script skips existing rows for users/venues) — or wipe and restart:
```bash
npm run migrate:down   # rolls back the migration
npm run migrate:up     # reapplies it (fresh tables)
npm run seed
```

**Server starts but `/health` shows `redis: down`**
Check that the Redis container is running and `REDIS_URL` in `backend/.env` is correct. The app will still function for most things, but seat-hold countdowns will be degraded (Postgres remains correct regardless — see `docs/CONCURRENCY.md`).

**Port 4000 already in use**
Change `PORT` in `backend/.env` and `VITE_API_URL` in `frontend/.env` to match.

## Frontend

**Blank page / "Failed to fetch" errors in the browser console**
The backend isn't running, or `VITE_API_URL` in `frontend/.env` doesn't point to it. Confirm `http://localhost:4000/health` returns `{"status":"healthy",...}` in your browser first.

**CORS errors in the browser console**
Confirm `CORS_ORIGIN` in `backend/.env` matches the URL your frontend is actually running on (default `http://localhost:5173`).

## VS Code

**TypeScript errors shown in the editor that don't appear when running `npm run dev`**
VS Code may be using a different (older) TypeScript version than the project's. Open any `.ts`/`.tsx` file, then `Cmd/Ctrl+Shift+P` → "TypeScript: Select TypeScript Version" → "Use Workspace Version".

**ESLint/Prettier not formatting on save**
Make sure you installed the recommended extensions (VS Code should have prompted you — if not, open the Extensions panel and search "@recommended").

## Tests

**`npm run test:backend` hangs or times out**
This usually means Postgres or Redis isn't reachable from the test process. Confirm Docker containers are running and `backend/.env` is configured, same as for the main app.

**Concurrency test occasionally takes a few seconds**
This is expected — 20 simultaneous transactions genuinely contending for one row takes a small amount of real time to resolve. A multi-second runtime is normal, not a bug.

## Still stuck?

Check the backend terminal output — most errors include a clear message (e.g. "Cannot start server without a database connection. Check DATABASE_URL in .env"). The `/health` endpoint is also your fastest diagnostic: `curl http://localhost:4000/health`.
