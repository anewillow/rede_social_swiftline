import * as service from '../services/comments-service.js';
import { handle } from './handle.js';

export const createComment = handle(service.createComment);
export const updateComment = handle(service.updateComment);
export const deleteComment = handle(service.deleteComment);
export const listComments = handle(service.listComments);
export const toggleLike = handle(service.toggleLike);
