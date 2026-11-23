import database from '../config/database.js';
import { createSequelizeUnitOfWork } from '../infrastructure/database/unit-of-work.js';
import { createInteractionAccounts } from '../modules/accounts/persistence/interaction-accounts-repository.js';
import { createPostInteractions } from '../modules/posts/persistence/post-interactions-repository.js';
import { createNetworkInteractions } from '../modules/network/persistence/network-interactions-repository.js';
import { createNotificationRecorder } from '../modules/notifications/persistence/notification-recorder-repository.js';
import { createPostInteractionOperations, type InteractionScope } from '../workflows/post-interactions.js';

export const postInteractions = createPostInteractionOperations(createSequelizeUnitOfWork<InteractionScope>(database, (transaction) => ({
  accounts: createInteractionAccounts(transaction), posts: createPostInteractions(transaction),
  network: createNetworkInteractions(transaction), notifications: createNotificationRecorder(transaction),
})));
