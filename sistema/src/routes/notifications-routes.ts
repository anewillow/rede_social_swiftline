import { Router } from 'express';
import * as controller from '../controllers/notifications-controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get("/api/notifications", requireAuth, controller.listNotifications);
router.put("/api/notifications/read", requireAuth, controller.markAsRead);

export default router;
