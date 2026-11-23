import * as service from '../services/polls-service.js';
import { handle } from './handle.js';

export const vote = handle(service.vote);
export const updatePoll = handle(service.updatePoll);
export const deletePoll = handle(service.deletePoll);
