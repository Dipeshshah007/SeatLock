import { Router } from 'express';
import * as seatController from '../controllers/seatController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/hold', authenticate, seatController.hold);
router.post('/release', authenticate, seatController.release);

export default router;
