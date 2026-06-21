import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/authRoutes';
import eventRoutes from './routes/eventRoutes';
import seatRoutes from './routes/seatRoutes';
import bookingRoutes from './routes/bookingRoutes';
import venueRoutes from './routes/venueRoutes';
import adminRoutes from './routes/adminRoutes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { checkDbConnection } from './config/db';
import { checkRedisConnection } from './config/redis';

export function createApp(): Application {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN?.split(',') || 'http://localhost:5173',
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

  // Stricter rate limit specifically on the seat-hold endpoint, since it's
  // the one most exposed to abuse (bots holding every seat to scalp/block).
  const holdLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many seat hold requests, please slow down.' },
  });
  app.use('/api/seats/hold', holdLimiter);

  const generalLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api', generalLimiter);

  app.get('/health', async (_req: Request, res: Response) => {
    const [dbOk, redisOk] = await Promise.all([checkDbConnection(), checkRedisConnection()]);
    const ok = dbOk && redisOk;
    res.status(ok ? 200 : 503).json({
      status: ok ? 'healthy' : 'degraded',
      postgres: dbOk ? 'up' : 'down',
      redis: redisOk ? 'up' : 'down',
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/events', eventRoutes);
  app.use('/api/seats', seatRoutes);
  app.use('/api/bookings', bookingRoutes);
  app.use('/api/venues', venueRoutes);
  app.use('/api/admin', adminRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
