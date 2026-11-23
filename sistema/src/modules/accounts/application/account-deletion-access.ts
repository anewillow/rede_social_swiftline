import type { AccountDeletionAccess, AccountToDelete } from '../public.js';

export type AccountDeletionRecord = AccountToDelete & { passwordHash: string };

export interface AccountDeletionReader {
  findById(userId: number): Promise<AccountDeletionRecord | null>;
}

export type AccountDeletionErrorCode = 'ACCOUNT_NOT_FOUND' | 'PASSWORD_REQUIRED' | 'INVALID_PASSWORD';

export class AccountDeletionError extends Error {
  constructor(public readonly code: AccountDeletionErrorCode, message: string) {
    super(message);
    this.name = 'AccountDeletionError';
  }
}

export function createAccountDeletionAccess(dependencies: {
  accounts: AccountDeletionReader;
  verifyPassword: (password: string, hash: string) => Promise<boolean>;
}): AccountDeletionAccess {
  return {
    async authorizeDeletion(userId, password) {
      const account = await dependencies.accounts.findById(userId);
      if (!account)
        throw new AccountDeletionError('ACCOUNT_NOT_FOUND', 'Usuário não encontrado.');
      if (!password)
        throw new AccountDeletionError('PASSWORD_REQUIRED', 'Digite sua senha para confirmar a exclusão.');
      if (!(await dependencies.verifyPassword(password, account.passwordHash)))
        throw new AccountDeletionError('INVALID_PASSWORD', 'Senha incorreta.');

      return { id: account.id, avatar: account.avatar, cover: account.cover };
    },
  };
}
