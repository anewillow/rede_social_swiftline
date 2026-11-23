import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Page, Route } from '@playwright/test';

test('publicação compartilhada nas três telas com MySQL descartável', {
  skip: !process.env.SWIFTLINE_DISPOSABLE_MYSQL || process.env.SWIFTLINE_MYSQL_SUITE !== 'post-interface',
}, async (t) => {
  const expectedDirectory = process.env.SWIFTLINE_DISPOSABLE_MYSQL!;
  assert.equal(process.env.DB_HOST, '127.0.0.1');
  assert.equal(process.env.DB_NAME, 'swiftline_posts_test');
  assert.ok(path.basename(path.dirname(expectedDirectory)).startsWith('swiftline-posts-mysql-'));
  assert.equal(path.resolve(process.cwd()), path.resolve(path.dirname(expectedDirectory)));
  const { default: database } = require('../../src/config/database.js') as typeof import('../../src/config/database.js');
  const { default: app } = require('../../src/app.js') as typeof import('../../src/app.js');
  const { User, Post, Comment, Like, Repost, SavedPost, PollOption, PollVote, PostView } = await import('../../src/models/index.js');
  const { secret } = await import('../../src/middleware/auth.js');
  const { chromium, expect } = await import('@playwright/test');
  const candidate = process.env.SWIFTLINE_CHROME_BINARY || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  let server: ReturnType<typeof app.listen> | undefined;
  let baseUrl: string;
  type Screen = 'feed' | 'profile' | 'saved';
  const screens: Screen[] = ['feed', 'profile', 'saved'];
  const errors: string[] = [];

  try {
    await database.authenticate();
    const [location] = await database.query('SELECT @@datadir AS directory');
    const normalize = (value: string) => process.platform === 'win32' ? path.resolve(value).toLowerCase() : path.resolve(value);
    assert.equal(normalize((location as Array<{ directory: string }>)[0].directory), normalize(expectedDirectory));
    const { prepareMigratedTestDatabase } = await import('../helpers/prepare-migrated-database.js');
    await prepareMigratedTestDatabase();
    const tag = randomUUID().slice(0, 8);
    const hash = await bcrypt.hash('senha-do-teste', 4);
    const [owner, viewer] = await User.bulkCreate([
      { username: 'autor_' + tag, email: 'autor-' + tag + '@example.test', password: hash },
      { username: 'leitor_' + tag, email: 'leitor-' + tag + '@example.test', password: hash },
    ]);
    const normal = await Post.create({ userId: owner.id, content: 'Publicação usada nas três telas' });
    const polls: Record<string, InstanceType<typeof Post>> = {};
    const deletable: Record<string, InstanceType<typeof Post>> = {};
    for (const screen of screens) {
      polls[screen] = await Post.create({ userId: owner.id, content: 'Enquete para ' + screen });
      await PollOption.bulkCreate([
        { postId: polls[screen].id, text: 'Opção A', position: 0 },
        { postId: polls[screen].id, text: 'Opção B', position: 1 },
      ]);
      deletable[screen] = await Post.create({ userId: owner.id, content: 'Publicação para excluir em ' + screen });
    }
    await Comment.bulkCreate([
      { postId: normal.id, userId: viewer.id, content: 'Comentário próprio do leitor' },
      { postId: normal.id, userId: owner.id, content: 'Comentário de outra pessoa' },
    ]);
    const ids = [normal.id, ...Object.values(polls).map((post) => post.id), ...Object.values(deletable).map((post) => post.id)];
    await SavedPost.bulkCreate([owner.id, viewer.id].flatMap((userId) => ids.map((postId) => ({ userId, postId }))));
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    baseUrl = 'http://127.0.0.1:' + address.port;
    browser = await chromium.launch({ headless: true, ...(fs.existsSync(candidate) ? { executablePath: candidate } : {}) });

    async function openContext(user: { id: number; username: string; email: string }) {
      const context = await browser!.newContext({ viewport: { width: 1440, height: 1000 } });
      await context.route('**/*', async (route) => {
        const url = new URL(route.request().url());
        if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort();
        if (url.pathname === '/api/v2/news') return route.fulfill({ json: { news: [] } });
        if (url.pathname === '/api/v2/trends') return route.fulfill({ json: { trends: [] } });
        return route.continue();
      });
      await context.addInitScript(({ token, currentUser }) => {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(currentUser));
        Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => {} } });
      }, { token: jwt.sign({ id: user.id }, secret()), currentUser: { id: user.id, username: user.username, email: user.email } });
      const page = await context.newPage();
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(baseUrl + '/feed.html');
      await expect(page.locator('#post-' + normal.id)).toBeVisible({ timeout: 15000 });
      return { context, page };
    }
    const reader = await openContext(viewer);
    const card = (page: Page, id: number) => page.locator('#post-' + id);
    async function navigate(page: Page, screen: Screen, id: number) {
      if (screen === 'saved') await page.getByRole('button', { name: 'Salvos', exact: true }).click();
      else {
        await page.getByRole('button', { name: 'Início', exact: true }).click();
        await expect(card(page, normal.id)).toBeVisible();
        if (screen === 'profile') {
          await card(page, normal.id).getByRole('button', { name: owner.username, exact: true }).click();
          await expect(page.locator('.swift-profile')).toBeVisible();
        }
      }
      await expect(card(page, id)).toBeVisible();
      return card(page, id);
    }
    async function openComments(article: ReturnType<typeof card>) {
      const toggle = article.getByRole('button', { name: 'Comentários', exact: true });
      if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
      return article.locator('.comments');
    }

    await t.test('feed, perfil e salvos oferecem enquetes, ações e as mesmas permissões de comentário', async () => {
      for (const screen of screens) {
        const article = await navigate(reader.page, screen, normal.id);
        await expect(article.getByRole('button', { name: 'Opções da publicação' })).toHaveCount(0);
        await expect(article.getByRole('button', { name: 'Curtir', exact: true })).toBeVisible();
        const comments = await openComments(article);
        const own = comments.locator('.comment').filter({ hasText: 'Comentário próprio do leitor' });
        const other = comments.locator('.comment').filter({ hasText: 'Comentário de outra pessoa' });
        await expect(own.getByRole('button', { name: 'Editar', exact: true })).toBeVisible();
        await expect(own.getByRole('button', { name: 'Excluir', exact: true })).toBeVisible();
        await expect(other).toBeVisible();
        await expect(other.getByRole('button', { name: 'Editar', exact: true })).toHaveCount(0);
        await expect(other.getByRole('button', { name: 'Excluir', exact: true })).toHaveCount(0);
        await expect(card(reader.page, polls.feed.id).getByRole('radiogroup')).toBeVisible();
        const output = path.resolve(__dirname, '../../../test-results/posts-shared-' + screen + '.png');
        fs.mkdirSync(path.dirname(output), { recursive: true });
        await reader.page.screenshot({ path: output });
      }
    });

    await t.test('curtir, repostar, compartilhar e salvar atualizam a publicação compartilhada', async () => {
      let article = await navigate(reader.page, 'feed', normal.id);
      await article.getByRole('button', { name: 'Curtir', exact: true }).click();
      await expect(article.getByRole('button', { name: 'Remover curtida', exact: true })).toHaveAttribute('aria-pressed', 'true');
      let release!: () => void;
      const pendingRead = new Promise<void>((resolve) => { release = resolve; });
      const delayed = async (route: Route) => { await pendingRead; await route.continue(); };
      await reader.context.route('**/api/v2/posts/saved', delayed);
      try {
        article = await navigate(reader.page, 'saved', normal.id);
        await expect(article.getByRole('button', { name: 'Remover curtida', exact: true })).toHaveAttribute('aria-pressed', 'true');
      } finally { release(); }
      await reader.context.unroute('**/api/v2/posts/saved', delayed);
      await article.getByRole('button', { name: 'Repostar', exact: true }).click();
      await expect(article.getByRole('button', { name: 'Remover repost', exact: true })).toHaveAttribute('aria-pressed', 'true');
      article = await navigate(reader.page, 'profile', normal.id);
      await expect(article.getByRole('button', { name: 'Remover repost', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await article.getByRole('button', { name: 'Compartilhar', exact: true }).click();
      await expect(article.getByRole('button', { name: 'Compartilhar', exact: true })).toContainText('1');
      article = await navigate(reader.page, 'saved', normal.id);
      await article.getByRole('button', { name: 'Remover dos salvos', exact: true }).click();
      await expect(card(reader.page, normal.id)).toHaveCount(0);
      article = await navigate(reader.page, 'feed', normal.id);
      await expect(article.getByRole('button', { name: 'Salvar', exact: true })).toBeVisible();
      await article.getByRole('button', { name: 'Salvar', exact: true }).click();
      await expect(article.getByRole('button', { name: 'Remover dos salvos', exact: true })).toBeVisible();
      assert.equal(await Like.count({ where: { userId: viewer.id, postId: normal.id } }), 1);
      assert.equal(await Repost.count({ where: { userId: viewer.id, postId: normal.id } }), 1);
      assert.equal((await Post.findByPk(normal.id))!.shares, 1);
      assert.equal(await PostView.count({ where: { userId: viewer.id, postId: normal.id } }), 1);
    });

    await t.test('criar, editar e excluir comentário funciona nas três telas', async () => {
      for (const screen of screens) {
        const article = await navigate(reader.page, screen, normal.id);
        const comments = await openComments(article);
        const original = 'Comentário criado em ' + screen;
        const updated = 'Comentário editado em ' + screen;
        await comments.getByPlaceholder('Escreva um comentário').fill(original);
        await comments.getByRole('button', { name: 'Enviar comentário' }).click();
        let item = comments.locator('.comment').filter({ hasText: original });
        await expect(item).toBeVisible();
        await item.getByRole('button', { name: 'Editar', exact: true }).click();
        await comments.getByLabel('Editar comentário').fill(updated);
        await comments.getByRole('button', { name: 'Salvar', exact: true }).click();
        item = comments.locator('.comment').filter({ hasText: updated });
        await expect(item).toBeVisible();
        assert.equal(await Comment.count({ where: { postId: normal.id, userId: viewer.id, content: updated } }), 1);
        reader.page.once('dialog', (dialog) => { void dialog.accept(); });
        await item.getByRole('button', { name: 'Excluir', exact: true }).click();
        await expect(item).toHaveCount(0);
        assert.equal(await Comment.count({ where: { postId: normal.id, userId: viewer.id, content: updated } }), 0);
      }
    });

    await t.test('votar a partir de cada tela mantém o resultado ao abrir as outras', async () => {
      for (const screen of screens) {
        const postId = polls[screen].id;
        let article = await navigate(reader.page, screen, postId);
        await article.getByRole('radio', { name: 'Opção A', exact: true }).click();
        const responsePromise = reader.page.waitForResponse((response) => response.url().endsWith('/api/v2/posts/' + postId + '/poll-vote'));
        await article.getByRole('button', { name: 'Confirmar voto' }).click();
        const response = await responsePromise;
        const voteResult = await response.json();
        assert.equal(response.status(), 200, JSON.stringify(voteResult));
        assert.equal(voteResult.poll.totalVotes, 1, JSON.stringify(voteResult));
        assert.equal(voteResult.poll.votedOptionId, voteResult.poll.options[0].id, JSON.stringify(voteResult));
        await expect(article.getByRole('progressbar', { name: 'Opção A: 100%' })).toBeVisible();
        for (const other of screens.filter((value) => value !== screen)) {
          article = await navigate(reader.page, other, postId);
          await expect(article.getByRole('progressbar', { name: 'Opção A: 100%' })).toBeVisible();
        }
        assert.equal(await PollVote.count({ where: { postId, userId: viewer.id } }), 1);
      }
    });

    await t.test('o autor edita e exclui publicações e enquetes em qualquer uma das telas', async () => {
      const author = await openContext(owner);
      for (const screen of screens) {
        let article = await navigate(author.page, screen, normal.id);
        await article.getByRole('button', { name: 'Opções da publicação' }).click();
        await article.locator('.owner-post-menu-popover').getByRole('button', { name: /^Editar/ }).click();
        const dialog = author.page.getByRole('dialog');
        const content = 'Texto atualizado em ' + screen;
        await dialog.getByLabel('Texto da publicação').fill(content);
        await dialog.getByRole('button', { name: 'Salvar alterações' }).click();
        await expect(dialog).toHaveCount(0);
        await expect(article.locator('.post-content')).toHaveText(content);
        assert.equal((await Post.findByPk(normal.id))!.content, content);
        article = card(author.page, polls[screen].id);
        const poll = article.locator('.post-poll');
        await poll.getByRole('button', { name: 'Editar', exact: true }).click();
        const question = 'Pergunta atualizada em ' + screen;
        await poll.getByLabel('Pergunta').fill(question);
        await poll.getByLabel('Opção A', { exact: true }).fill('Resposta A atualizada');
        const [savedPoll] = await Promise.all([
          author.page.waitForResponse((response) => response.request().method() === 'PUT' && response.url().endsWith('/api/v2/posts/' + polls[screen].id + '/poll')),
          poll.getByRole('button', { name: 'Salvar alterações' }).click(),
        ]);
        assert.equal(savedPoll.status(), 200, await savedPoll.text());
        await expect(article.locator('.post-content')).toHaveText(question);
        assert.equal(await PollVote.count({ where: { postId: polls[screen].id } }), 1);
        await poll.getByRole('button', { name: 'Excluir', exact: true }).click();
        await poll.getByRole('button', { name: 'Excluir enquete', exact: true }).click();
        await expect(poll).toHaveCount(0);
        await expect(article.getByRole('button', { name: 'Opções da publicação' })).toBeVisible();
        assert.ok(await Post.findByPk(polls[screen].id));
        assert.equal(await PollVote.count({ where: { postId: polls[screen].id } }), 0);
        article = card(author.page, deletable[screen].id);
        await article.getByRole('button', { name: 'Opções da publicação' }).click();
        await article.locator('.owner-post-menu-popover').getByRole('button', { name: /^Excluir/ }).click();
        await author.page.getByRole('dialog').getByRole('button', { name: 'Excluir publicação', exact: true }).click();
        await expect(article).toHaveCount(0);
        assert.equal(await Post.findByPk(deletable[screen].id), null);
      }
    });

    await t.test('falhas de interação e de comentários preservam a tela e permitem tentar novamente', async () => {
      const retry = await openContext(viewer);
      const article = card(retry.page, normal.id);
      const likedBefore = await Like.count({ where: { userId: viewer.id, postId: normal.id } });
      const likeUrl = '**/api/v2/posts/' + normal.id + '/like';
      await retry.page.route(likeUrl, (route) => route.fulfill({ status: 503, json: { error: { code: 'SERVICE_UNAVAILABLE', message: 'Falha controlada' }, requestId: 'teste' } }));
      const reaction = () => article.getByRole('button', { name: likedBefore ? 'Remover curtida' : 'Curtir', exact: true });
      await reaction().click();
      await expect(article.getByRole('status')).toContainText('Falha controlada');
      assert.equal(await Like.count({ where: { userId: viewer.id, postId: normal.id } }), likedBefore);
      await retry.page.unroute(likeUrl);
      await reaction().click();
      await expect(article.getByRole('button', { name: likedBefore ? 'Curtir' : 'Remover curtida', exact: true })).toBeVisible();
      const commentsUrl = '**/api/v2/posts/' + normal.id + '/comments';
      await retry.page.route(commentsUrl, (route) => route.fulfill({ status: 503, json: { error: { code: 'SERVICE_UNAVAILABLE', message: 'Indisponível' }, requestId: 'teste' } }));
      const comments = await openComments(article);
      await expect(comments.getByRole('alert')).toContainText('Indisponível');
      await retry.page.unroute(commentsUrl);
      await comments.getByRole('button', { name: 'Tentar novamente' }).click();
      await expect(comments.locator('.comment').filter({ hasText: 'Comentário próprio do leitor' })).toBeVisible();
      await expect(comments.getByRole('alert')).toHaveCount(0);
      assert.deepEqual(errors, []);
    });
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
    await database.close();
  }
});
