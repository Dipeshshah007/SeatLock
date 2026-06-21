import cron from 'node-cron';
import { releaseAllExpiredHolds } from '../services/seatLockService';

/**
 * Runs every 30 seconds as a safety net to release any seat holds whose
 * `held_until` has passed. This is the backstop in case:
 *   - Redis TTL events were missed (we don't even rely on Redis keyspace
 *     notifications, intentionally, to keep the system simple & robust)
 *   - The app crashed between holding a seat and the user completing
 *     checkout, leaving an orphaned HELD row
 *
 * Postgres timestamps (held_until) are the real source of truth for
 * expiry; this job just makes sure that truth gets acted on promptly.
 */
export function startHoldSweepJob(): void {
  cron.schedule('*/30 * * * * *', async () => {
    try {
      const released = await releaseAllExpiredHolds();
      if (released > 0) {
        // eslint-disable-next-line no-console
        console.log(`🧹 Hold sweep: released ${released} expired seat hold(s)`);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Hold sweep job failed:', err);
    }
  });
  // eslint-disable-next-line no-console
  console.log('⏰ Hold sweep cron job scheduled (every 30s)');
}
