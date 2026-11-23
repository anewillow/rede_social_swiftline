import { Router } from 'express';
import * as controller from '../controllers/account-controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.delete("/api/auth/delete", requireAuth, controller.deleteAccount);

export default router;
