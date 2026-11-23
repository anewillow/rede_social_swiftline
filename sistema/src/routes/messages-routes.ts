import { Router } from 'express';
import * as controller from '../controllers/messages-controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get("/api/messages/people", requireAuth, controller.searchPeople);
router.get("/api/messages/:userId", requireAuth, controller.listMessages);
router.post("/api/messages/:userId", requireAuth, controller.sendMessage);

export default router;
