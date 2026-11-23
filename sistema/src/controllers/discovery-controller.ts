import * as service from '../services/discovery-service.js';
import { handle } from './handle.js';

export const search = handle(service.search);
export const getTrends = handle(service.getTrends);
export const getNews = handle(service.getNews);
