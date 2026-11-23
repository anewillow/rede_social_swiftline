import { Router } from 'express';
import * as controller from '../controllers/users-controller.js';
import { optionalAuth } from '../middleware/auth.js';

const router = Router();

router.get("/api/users/search", optionalAuth, controller.searchUsers);
router.get("/api/users/username/:username", optionalAuth, controller.findByUsername);
router.get("/api/users/id/:id", optionalAuth, controller.findById);
router.get("/api/users/:username/followers", optionalAuth, controller.listFollowers);
router.get("/api/users/:username/following", optionalAuth, controller.listFollowing);

export default router;
