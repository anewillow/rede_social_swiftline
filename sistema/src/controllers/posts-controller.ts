import * as service from '../services/posts-service.js';
import { handle } from './handle.js';

export const listPosts = handle(service.listPosts);
export const getPost = handle(service.getPost);
export const listSavedPosts = handle(service.listSavedPosts);
export const createPost = handle(service.createPost);
export const updatePost = handle(service.updatePost);
export const toggleLike = handle(service.toggleLike);
export const toggleRepost = handle(service.toggleRepost);
export const toggleSavedPost = handle(service.toggleSavedPost);
export const recordViews = handle(service.recordViews);
export const sharePost = handle(service.sharePost);
export const deletePost = handle(service.deletePost);
