import { Router } from 'express';
import * as controller from '../controllers/discovery-controller.js';
import { optionalAuth } from '../middleware/auth.js';

const router = Router();

router.get("/api/search", optionalAuth, controller.search);
router.get("/api/trends", controller.getTrends);
router.get("/api/news", controller.getNews);

export default router;
