import { Router } from 'express';
import * as adminController from '../controllers/adminController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.get('/stats', authenticate, requireRole('ADMIN'), adminController.dashboardStats);

export default router;
