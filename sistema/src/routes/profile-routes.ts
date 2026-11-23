import { Router } from 'express';
import * as controller from '../controllers/profile-controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.put("/api/auth/profile", requireAuth, controller.updateProfile);

export default router;
