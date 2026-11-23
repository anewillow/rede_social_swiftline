import * as service from '../services/follow-service.js';
import { handle } from './handle.js';

export const follow = handle(service.follow);
export const unfollow = handle(service.unfollow);
export const isFollowing = handle(service.isFollowing);
