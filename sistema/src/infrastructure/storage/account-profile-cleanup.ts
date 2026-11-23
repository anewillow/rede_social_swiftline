import type { AccountToDelete } from '../../modules/accounts/public.js';
import { removeStoredProfileImage } from '../../services/profile-images-service.js';

export function createAccountProfileCleanup(directory: string) {
  return async (account: AccountToDelete): Promise<void> => {
    await Promise.allSettled([
      removeStoredProfileImage(account.avatar, directory, account.id, 'avatar'),
      removeStoredProfileImage(account.cover, directory, account.id, 'cover'),
    ]);
  };
}
