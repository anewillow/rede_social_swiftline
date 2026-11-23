import { Router } from 'express';
import * as controller from '../controllers/auth-controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post("/api/auth/register", controller.register);
router.post("/api/auth/login", controller.login);
router.get("/api/auth/me", requireAuth, controller.getCurrentUser);

export default router;
