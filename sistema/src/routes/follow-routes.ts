import { Router } from 'express';
import * as controller from '../controllers/follow-controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post("/api/follow/follow/:username", requireAuth, controller.follow);
router.post("/api/follow/unfollow/:username", requireAuth, controller.unfollow);
router.get("/api/follow/is-following/:username", requireAuth, controller.isFollowing);

export default router;
