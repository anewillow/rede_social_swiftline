import * as service from '../services/auth-service.js';
import { handle } from './handle.js';

export const register = handle(service.register);
export const login = handle(service.login);
export const getCurrentUser = handle(service.getCurrentUser);
