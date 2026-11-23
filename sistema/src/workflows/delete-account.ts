import type { AccountDeletionAccess, AccountsRemoval, AccountToDelete } from '../modules/accounts/public.js';
import type { MessagesAccountRemoval } from '../modules/messages/public.js';
import type { NetworkAccountRemoval } from '../modules/network/public.js';
import type { NotificationsAccountRemoval } from '../modules/notifications/public.js';
import type { PostsAccountRemoval } from '../modules/posts/public.js';
import type { UnitOfWork } from './ports/unit-of-work.js';

export type AccountDeletionScope = {
  accounts: AccountsRemoval;
  posts: PostsAccountRemoval;
  network: NetworkAccountRemoval;
  messages: MessagesAccountRemoval;
  notifications: NotificationsAccountRemoval;
};

export type DeleteAccountInput = { userId: number; password?: string };

export function createDeleteAccount(dependencies: {
  accounts: AccountDeletionAccess;
  unitOfWork: UnitOfWork<AccountDeletionScope>;
  removeProfileImages: (account: AccountToDelete) => Promise<void>;
}): (input: DeleteAccountInput) => Promise<void> {
  return async ({ userId, password }) => {
    const account = await dependencies.accounts.authorizeDeletion(userId, password);

    await dependencies.unitOfWork.run(async (modules) => {
      await modules.posts.removeAccountData(account.id);
      await modules.network.removeAccountData(account.id);
      await modules.messages.removeAccountData(account.id);
      await modules.notifications.removeAccountData(account.id);
      await modules.accounts.removeAccount(account.id);
    });

    // A limpeza ocorre depois do commit. Uma falha no disco não desfaz a conta já excluída.
    await Promise.allSettled([dependencies.removeProfileImages(account)]);
  };
}
