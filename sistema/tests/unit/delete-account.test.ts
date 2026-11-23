import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AccountDeletionError, createAccountDeletionAccess } from '../../src/modules/accounts/public.js';
import { createDeleteAccount, type AccountDeletionScope } from '../../src/workflows/delete-account.js';

const account = { id: 7, avatar: '/uploads/avatar-7-test.png', cover: null };

test('a confirmação de exclusão preserva as validações e não devolve o hash da senha', async (t) => {
  for (const scenario of [
    { title: 'conta ausente', exists: false, password: 'correta', code: 'ACCOUNT_NOT_FOUND' },
    { title: 'senha ausente', exists: true, password: undefined, code: 'PASSWORD_REQUIRED' },
    { title: 'senha incorreta', exists: true, password: 'incorreta', code: 'INVALID_PASSWORD' },
    { title: 'senha correta', exists: true, password: 'correta', code: undefined },
  ]) {
    await t.test(scenario.title, async () => {
      let checked = 0;
      const access = createAccountDeletionAccess({
        accounts: { async findById(id) {
          assert.equal(id, 7);
          return scenario.exists ? { ...account, passwordHash: 'hash-controlado' } : null;
        } },
        async verifyPassword(password, hash) {
          checked++;
          assert.equal(hash, 'hash-controlado');
          return password === 'correta';
        },
      });
      if (scenario.code) {
        await assert.rejects(access.authorizeDeletion(7, scenario.password), (error: unknown) =>
          error instanceof AccountDeletionError && error.code === scenario.code);
      } else {
        assert.deepEqual(await access.authorizeDeletion(7, scenario.password), account);
      }
      assert.equal(checked, scenario.exists && scenario.password ? 1 : 0);
    });
  }
});

test('a exclusão coordena os módulos e só limpa imagens depois da confirmação do banco', async () => {
  const calls: string[] = [];
  let committed = false;
  const removal = (name: string) => async (id: number) => { assert.equal(id, 7); calls.push(name); };
  const scope: AccountDeletionScope = {
    posts: { removeAccountData: removal('publicações') },
    network: { removeAccountData: removal('rede') },
    messages: { removeAccountData: removal('mensagens') },
    notifications: { removeAccountData: removal('notificações') },
    accounts: { async removeAccount(id) {
      assert.equal(id, 7);
      assert.deepEqual(calls, ['publicações', 'rede', 'mensagens', 'notificações']);
      calls.push('conta');
    } },
  };
  const execute = createDeleteAccount({
    accounts: { async authorizeDeletion() { return account; } },
    unitOfWork: { async run(operation) { await operation(scope); committed = true; } },
    async removeProfileImages(value) {
      assert.equal(committed, true);
      assert.deepEqual(value, account);
      calls.push('imagens');
    },
  });
  await execute({ userId: 7, password: 'correta' });
  assert.deepEqual(calls, ['publicações', 'rede', 'mensagens', 'notificações', 'conta', 'imagens']);
});

test('a senha rejeitada impede a abertura da operação de remoção', async () => {
  let writes = 0;
  const execute = createDeleteAccount({
    accounts: { async authorizeDeletion() { throw new AccountDeletionError('INVALID_PASSWORD', 'Senha incorreta.'); } },
    unitOfWork: { async run() { writes++; } },
    async removeProfileImages() { writes++; },
  });
  await assert.rejects(execute({ userId: 7, password: 'incorreta' }), AccountDeletionError);
  assert.equal(writes, 0);
});

test('uma falha de módulo interrompe a exclusão e conserva as imagens', async () => {
  let accountRemoved = false;
  let imagesRemoved = false;
  const nothing = async () => {};
  const failure = new Error('Falha controlada de mensagens');
  const execute = createDeleteAccount({
    accounts: { async authorizeDeletion() { return account; } },
    unitOfWork: { async run(operation) {
      await operation({
        posts: { removeAccountData: nothing },
        network: { removeAccountData: nothing },
        messages: { async removeAccountData() { throw failure; } },
        notifications: { removeAccountData: nothing },
        accounts: { async removeAccount() { accountRemoved = true; } },
      });
    } },
    async removeProfileImages() { imagesRemoved = true; },
  });
  await assert.rejects(execute({ userId: 7, password: 'correta' }), (error) => error === failure);
  assert.equal(accountRemoved, false);
  assert.equal(imagesRemoved, false);
});

test('falha de limpeza após o commit não transforma uma conta já excluída em erro', async () => {
  const execute = createDeleteAccount({
    accounts: { async authorizeDeletion() { return account; } },
    unitOfWork: { async run() {} },
    async removeProfileImages() { throw new Error('Falha controlada de disco'); },
  });
  await execute({ userId: 7, password: 'correta' });
});
