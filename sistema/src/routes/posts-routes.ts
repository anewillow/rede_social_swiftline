import { Router } from 'express';
import * as controller from '../controllers/posts-controller.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { receivePostImage } from '../middleware/upload.js';

const router = Router();

router.get("/api/posts", optionalAuth, controller.listPosts);
router.get("/api/posts/saved", requireAuth, controller.listSavedPosts);
router.get("/api/posts/:id", optionalAuth, controller.getPost);
router.post("/api/posts", requireAuth, receivePostImage, controller.createPost);
router.put("/api/posts/:id", requireAuth, controller.updatePost);
router.post("/api/posts/:id/like", requireAuth, controller.toggleLike);
router.post("/api/posts/:id/repost", requireAuth, controller.toggleRepost);
router.post("/api/posts/:id/save", requireAuth, controller.toggleSavedPost);
router.post("/api/posts/views", requireAuth, controller.recordViews);
router.post("/api/posts/:id/share", requireAuth, controller.sharePost);
router.delete("/api/posts/:id", requireAuth, controller.deletePost);

export default router;
