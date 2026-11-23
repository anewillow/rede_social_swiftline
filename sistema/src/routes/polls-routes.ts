import { Router } from 'express';
import * as controller from '../controllers/polls-controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post("/api/posts/:id/poll-vote", requireAuth, controller.vote);
router.put("/api/posts/:id/poll", requireAuth, controller.updatePoll);
router.delete("/api/posts/:id/poll", requireAuth, controller.deletePoll);

export default router;
