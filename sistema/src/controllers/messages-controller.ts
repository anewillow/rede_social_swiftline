import * as service from '../services/messages-service.js';
import { handle } from './handle.js';

export const searchPeople = handle(service.searchPeople);
export const listMessages = handle(service.listMessages);
export const sendMessage = handle(service.sendMessage);
