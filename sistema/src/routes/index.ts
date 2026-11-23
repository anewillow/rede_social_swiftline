import { Router } from 'express';
import authRoutes from './auth-routes.js';
import profileRoutes from './profile-routes.js';
import accountRoutes from './account-routes.js';
import postsRoutes from './posts-routes.js';
import discoveryRoutes from './discovery-routes.js';
import pollsRoutes from './polls-routes.js';
import commentsRoutes from './comments-routes.js';
import usersRoutes from './users-routes.js';
import followRoutes from './follow-routes.js';
import notificationsRoutes from './notifications-routes.js';
import messagesRoutes from './messages-routes.js';

const router = Router();
router.use(authRoutes);
router.use(profileRoutes);
router.use(accountRoutes);
router.use(postsRoutes);
router.use(discoveryRoutes);
router.use(pollsRoutes);
router.use(commentsRoutes);
router.use(usersRoutes);
router.use(followRoutes);
router.use(notificationsRoutes);
router.use(messagesRoutes);

export default router;
