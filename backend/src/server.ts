import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app';
import { startHoldSweepJob } from './jobs/releaseExpiredHolds';
import { checkDbConnection } from './config/db';
import { checkRedisConnection } from './config/redis';

const PORT = process.env.PORT || 4000;

async function start(): Promise<void> {
  const app = createApp();

  const dbOk = await checkDbConnection();
  const redisOk = await checkRedisConnection();

  // eslint-disable-next-line no-console
  console.log(`PostgreSQL: ${dbOk ? '✅ connected' : '❌ NOT connected'}`);
  // eslint-disable-next-line no-console
  console.log(`Redis:      ${redisOk ? '✅ connected' : '❌ NOT connected'}`);

  if (!dbOk) {
    // eslint-disable-next-line no-console
    console.error('Cannot start server without a database connection. Check DATABASE_URL in .env');
    process.exit(1);
  }

  startHoldSweepJob();

  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`🚀 SeatLock API running on http://localhost:${PORT}`);
    // eslint-disable-next-line no-console
    console.log(`   Health check: http://localhost:${PORT}/health`);
  });
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server:', err);
  process.exit(1);
});
