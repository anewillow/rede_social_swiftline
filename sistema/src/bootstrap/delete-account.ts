import bcrypt from 'bcryptjs';
import database from '../config/database.js';
import { createSequelizeUnitOfWork } from '../infrastructure/database/unit-of-work.js';
import { tryImageCleanup } from '../infrastructure/storage/file-cleanup.js';
import { createAccountDeletionAccess } from '../modules/accounts/public.js';
import { accountDeletionReader, createAccountsRemoval } from '../modules/accounts/persistence/account-deletion-repository.js';
import { createMessagesAccountRemoval } from '../modules/messages/persistence/account-messages-repository.js';
import { createNetworkAccountRemoval } from '../modules/network/persistence/account-relations-repository.js';
import { createNotificationsAccountRemoval } from '../modules/notifications/persistence/account-notifications-repository.js';
import { createPostsAccountRemoval } from '../modules/posts/persistence/account-content-repository.js';
import { createDeleteAccount, type AccountDeletionScope } from '../workflows/delete-account.js';

const accounts = createAccountDeletionAccess({
  accounts: accountDeletionReader,
  verifyPassword: (password, hash) => bcrypt.compare(password, hash),
});

const unitOfWork = createSequelizeUnitOfWork<AccountDeletionScope>(database, (transaction) => ({
  accounts: createAccountsRemoval(transaction),
  posts: createPostsAccountRemoval(transaction),
  network: createNetworkAccountRemoval(transaction),
  messages: createMessagesAccountRemoval(transaction),
  notifications: createNotificationsAccountRemoval(transaction),
}));

export const deleteAccount = createDeleteAccount({
  accounts,
  unitOfWork,
  removeProfileImages: tryImageCleanup,
});
