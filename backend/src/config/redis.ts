import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    return Math.min(times * 200, 2000);
  },
});

redis.on('error', (err) => {
  // eslint-disable-next-line no-console
  console.error('Redis connection error:', err.message);
});

redis.on('connect', () => {
  // eslint-disable-next-line no-console
  console.log('✅ Redis connected');
});

export async function checkRedisConnection(): Promise<boolean> {
  try {
    const pong = await redis.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}
