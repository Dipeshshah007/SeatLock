import { Router } from 'express';
import * as eventController from '../controllers/eventController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.get('/', eventController.listEvents);
router.get('/:id', eventController.getEvent);
router.post('/', authenticate, requireRole('ORGANIZER', 'ADMIN'), eventController.createEvent);
router.patch(
  '/:id/cancel',
  authenticate,
  requireRole('ORGANIZER', 'ADMIN'),
  eventController.cancelEvent
);
router.post(
  '/admin/sweep-holds',
  authenticate,
  requireRole('ADMIN'),
  eventController.triggerHoldSweep
);

export default router;
