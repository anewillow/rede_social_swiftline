import * as service from '../services/profile-service.js';
import { handle } from './handle.js';

export const updateProfile = handle(service.updateProfile);
