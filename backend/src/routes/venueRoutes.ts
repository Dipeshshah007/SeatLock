import { Router } from 'express';
import * as venueController from '../controllers/venueController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.get('/', venueController.listVenues);
router.post('/', authenticate, requireRole('ORGANIZER', 'ADMIN'), venueController.createVenue);

export default router;
