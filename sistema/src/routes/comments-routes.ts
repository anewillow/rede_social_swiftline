import { Router } from 'express';
import * as controller from '../controllers/comments-controller.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';

const router = Router();

router.post("/api/posts/:id/comments", requireAuth, controller.createComment);
router.put("/api/posts/comments/:commentId", requireAuth, controller.updateComment);
router.delete("/api/posts/comments/:commentId", requireAuth, controller.deleteComment);
router.get("/api/posts/:id/comments", optionalAuth, controller.listComments);
router.post("/api/posts/comments/:commentId/like", requireAuth, controller.toggleLike);

export default router;
