import { Router } from 'express';
import * as bookingController from '../controllers/bookingController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/', authenticate, bookingController.createBooking);
router.get('/my', authenticate, bookingController.myBookings);
router.get('/:id', authenticate, bookingController.getBooking);
router.post('/:id/checkout', authenticate, bookingController.checkout);
router.post('/:id/cancel', authenticate, bookingController.cancel);

export default router;
