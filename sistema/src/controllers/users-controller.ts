import * as service from '../services/users-service.js';
import { handle } from './handle.js';

export const searchUsers = handle(service.searchUsers);
export const findByUsername = handle(service.findByUsername);
export const findById = handle(service.findById);
export const listFollowers = handle(service.listFollowers);
export const listFollowing = handle(service.listFollowing);
