import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import type { MigrationContext } from '../../src/infrastructure/database/migrations.js';

test('evolução do banco por uma sequência única em MySQL descartável', {
  skip: !process.env.SWIFTLINE_DISPOSABLE_MYSQL || process.env.SWIFTLINE_MYSQL_SUITE !== 'database-migrations',
}, async (t) => {
  assert.equal(process.env.DB_HOST, '127.0.0.1');
  assert.equal(process.env.DB_NAME, 'swiftline_database_test');
  const expectedDirectory = process.env.SWIFTLINE_DISPOSABLE_MYSQL!;
  assert.ok(path.basename(path.dirname(expectedDirectory)).startsWith('swiftline-database-mysql-'));
  assert.equal(path.resolve(process.cwd()), path.resolve(path.dirname(expectedDirectory)));
  const { connectForMigrations, databaseStatus, migrateDatabase, adoptDatabase, loadMigrations, HISTORY_TABLE } = await import('../../src/infrastructure/database/migrations.js');
  const { inspectSchema, quote, rows, schemaDifferences } = await import('../../src/infrastructure/database/schema-inspection.js');
  const connection = await connectForMigrations();
  const migrations = loadMigrations();
  const [location] = await rows<{ directory: string }>(connection, 'SELECT @@datadir AS directory');
  assert.equal(path.resolve(location.directory).toLowerCase(), path.resolve(expectedDirectory).toLowerCase());
  const root = path.resolve(__dirname, '../../..');

  async function reset() {
    await connection.query('SET FOREIGN_KEY_CHECKS=0');
    try { for (const table of Object.values(await inspectSchema(connection))) await connection.query('DROP TABLE ' + quote(table.name)); }
    finally { await connection.query('SET FOREIGN_KEY_CHECKS=1'); }
  }
  async function snapshot() {
    const result: Record<string, unknown> = {};
    for (const table of Object.values(await inspectSchema(connection))) {
      if (table.name === HISTORY_TABLE) continue;
      const data = await rows(connection, 'SELECT * FROM ' + quote(table.name));
      const definitions = await rows<Record<string, string>>(connection, 'SHOW CREATE TABLE ' + quote(table.name));
      const normalized = data.map((row) => JSON.stringify(row, Object.keys(row as object).sort())).sort();
      result[table.name] = { definition: definitions[0]['Create Table'], hash: createHash('sha256').update(JSON.stringify(normalized)).digest('hex'), count: data.length };
    }
    return result;
  }
  async function startAndStop(ready: boolean) {
    const child = spawn(process.execPath, [path.join(root, 'dist/src/server.js')], {
      cwd: process.cwd(), env: { ...process.env, PORT: '0' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    const exit = once(child, 'exit');
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => { child.kill(); reject(new Error('O servidor não respondeu dentro do prazo.\n' + output)); }, 15000);
      const receive = (chunk: Buffer) => {
        output += chunk.toString();
        if (ready && output.includes('Swiftline está online')) { clearTimeout(timeout); resolve(); }
      };
      child.stdout!.on('data', receive); child.stderr!.on('data', receive);
      child.once('error', (error) => { clearTimeout(timeout); reject(error); });
      child.once('exit', (code) => {
        clearTimeout(timeout);
        if (ready) reject(new Error('O servidor recusou uma base pronta:\n' + output));
        else { assert.equal(code, 1); assert.match(output, /banco precisa de atenção/); resolve(); }
      });
    });
    if (ready) { child.kill(); await exit; }
  }
  const directContext: MigrationContext = {
    query: async (sql: string, values: unknown[] = []) => (await connection.query(sql, values))[0],
    table: async (name: string) => (await inspectSchema(connection))[name.toLowerCase()]?.name,
    columns: async (name: string) => (await inspectSchema(connection))[name.toLowerCase()]?.columns ?? {},
  };
  try {
    await t.test('consultar ou iniciar uma base vazia não cria tabelas', async () => {
      assert.equal((await databaseStatus(connection)).ready, false);
      assert.deepEqual(await inspectSchema(connection), {});
      await startAndStop(false);
      assert.deepEqual(await inspectSchema(connection), {});
    });
    await t.test('instalação vazia cria as 13 tabelas, chaves e relacionamentos sem sync', async () => {
      assert.equal((await migrateDatabase(connection)).length, migrations.length);
      assert.equal((await databaseStatus(connection)).ready, true);
      assert.deepEqual(schemaDifferences(await inspectSchema(connection)), []);
      const { default: database } = require('../../src/config/database.js') as typeof import('../../src/config/database.js');
      const models = await import('../../src/models/index.js');
      try {
        const author = await models.User.create({ username: 'autor', email: 'autor@example.test', password: 'hash-teste' });
        const reader = await models.User.create({ username: 'leitor', email: 'leitor@example.test', password: 'hash-teste' });
        const post = await models.Post.create({ userId: author.id, content: 'Texto preservado' });
        const comment = await models.Comment.create({ userId: reader.id, postId: post.id, content: 'Comentário' });
        const option = await models.PollOption.create({ postId: post.id, text: 'Resposta', position: 0 });
        await Promise.all([
          models.CommentLike.create({ userId: author.id, commentId: comment.id }),
          models.Follow.create({ followerId: reader.id, followingId: author.id }),
          models.Like.create({ userId: reader.id, postId: post.id }),
          models.Repost.create({ userId: reader.id, postId: post.id }),
          models.SavedPost.create({ userId: reader.id, postId: post.id }),
          models.PostView.create({ userId: reader.id, postId: post.id }),
          models.PollVote.create({ userId: reader.id, postId: post.id, optionId: option.id }),
          models.Message.create({ senderId: author.id, receiverId: reader.id, content: 'Mensagem' }),
          models.Notification.create({ userId: author.id, actorId: reader.id, type: 'comment', message: 'Comentou' }),
        ]);
        await assert.rejects(models.Like.create({ userId: reader.id, postId: post.id }));
        await assert.rejects(models.PollVote.create({ userId: reader.id, postId: post.id, optionId: option.id }));
      } finally { await database.close(); }
      const before = await snapshot();
      assert.deepEqual(await migrateDatabase(connection), []);
      await startAndStop(true);
      assert.deepEqual(await snapshot(), before);
    });
    await t.test('um arquivo alterado ou uma versão futura bloqueia a abertura e a atualização', async () => {
      await connection.query(`UPDATE ${quote(HISTORY_TABLE)} SET checksum=? WHERE version=?`, ['0'.repeat(64), migrations[0].id]);
      const before = await snapshot();
      assert.equal((await databaseStatus(connection)).ready, false);
      await assert.rejects(migrateDatabase(connection), /histórico não corresponde/);
      await startAndStop(false);
      assert.deepEqual(await snapshot(), before);
      await connection.query(`UPDATE ${quote(HISTORY_TABLE)} SET checksum=? WHERE version=?`, [migrations[0].checksum, migrations[0].id]);
      await connection.query(`INSERT INTO ${quote(HISTORY_TABLE)} (version,checksum,state,mode,startedAt,appliedAt) VALUES ('9999-future.js',?,'applied','migrated',NOW(),NOW())`, ['a'.repeat(64)]);
      assert.equal((await databaseStatus(connection)).ready, false);
      await assert.rejects(migrateDatabase(connection), /histórico não corresponde/);
      await startAndStop(false);
    });
    await t.test('falha após DDL parcial fica registrada e a nova execução retoma a etapa', async () => {
      await reset();
      const interrupted = migrations.map((migration, index) => index ? migration : {
        ...migration, up: async (context: typeof directContext) => {
          let count = 0;
          await migration.up({ ...context, query: async (sql, values) => { const result = await context.query(sql, values); if (++count === 1) throw new Error('Interrupção controlada'); return result; } });
        },
      });
      await assert.rejects(migrateDatabase(connection, interrupted), /Interrupção controlada/);
      assert.ok((await inspectSchema(connection)).users);
      const record = await rows<{ state: string }>(connection, `SELECT state FROM ${quote(HISTORY_TABLE)}`);
      assert.equal(record[0].state, 'failed');
      await startAndStop(false);
      await migrateDatabase(connection);
      assert.equal((await databaseStatus(connection)).ready, true);
    });
    await t.test('duas atualizações não executam migrações ao mesmo tempo', async () => {
      await reset();
      const other = await connectForMigrations();
      let entered!: () => void, release!: () => void;
      const started = new Promise<void>((resolve) => { entered = resolve; });
      const wait = new Promise<void>((resolve) => { release = resolve; });
      const paused = migrations.map((migration, index) => index ? migration : { ...migration, up: async (context: typeof directContext) => { entered(); await wait; await migration.up(context); } });
      const running = migrateDatabase(connection, paused);
      try {
        await started;
        await assert.rejects(migrateDatabase(other), /Outra atualização/);
      } finally { release(); await running; await other.end(); }
    });
    await t.test('alteração de estrutura fora da sequência bloqueia a abertura sem reparo automático', async () => {
      await connection.query('ALTER TABLE Users DROP COLUMN cover');
      const before = await snapshot();
      assert.equal((await databaseStatus(connection)).ready, false);
      await startAndStop(false);
      await assert.rejects(migrateDatabase(connection), /esquema mudou fora das migrações/);
      assert.deepEqual(await snapshot(), before);
    });
    await t.test('adoção confere a estrutura e os dados antes de registrar a versão', async () => {
      await reset();
      await migrations[0].up(directContext);
      await connection.query("INSERT INTO Users (username,email,password,createdAt,updatedAt) VALUES ('autor','autor@example.test','hash',NOW(),NOW())");
      await connection.query('ALTER TABLE posts MODIFY content TEXT NULL');
      const incompatible = await snapshot();
      await assert.rejects(adoptDatabase(connection), /Definição incompatível: posts.content/);
      assert.deepEqual(await snapshot(), incompatible);
      assert.equal((await inspectSchema(connection))[HISTORY_TABLE], undefined);
      await connection.query('ALTER TABLE posts MODIFY content VARCHAR(255) NULL');
      await connection.query('SET FOREIGN_KEY_CHECKS=0');
      await connection.query('INSERT INTO posts (userId,createdAt,updatedAt) VALUES (99999,NOW(),NOW())');
      await connection.query('SET FOREIGN_KEY_CHECKS=1');
      await assert.rejects(adoptDatabase(connection), /referências inválidas/);
      assert.equal((await inspectSchema(connection))[HISTORY_TABLE], undefined);
    });
    await t.test('base anterior recebe capa, enquetes e autoria atual pelo mesmo comando', async () => {
      await reset();
      await migrations[0].up(directContext);
      await connection.query("INSERT INTO Users (username,email,password,createdAt,updatedAt) VALUES ('autor','autor@example.test','hash',NOW(),NOW())");
      await connection.query('ALTER TABLE posts ADD author VARCHAR(255) NULL, ADD avatar TEXT NULL');
      await connection.query("INSERT INTO posts (userId,content,author,avatar,createdAt,updatedAt) VALUES (1,'Conteúdo','Nome antigo','foto-antiga',NOW(),NOW())");
      await assert.rejects(migrateDatabase(connection), /db:adopt/);
      await adoptDatabase(connection);
      const [record] = await rows<{ mode: string }>(connection, `SELECT mode FROM ${quote(HISTORY_TABLE)}`);
      assert.equal(record.mode, 'adopted');
      await startAndStop(false);
      assert.equal((await migrateDatabase(connection)).length, migrations.length - 1);
      const [post] = await rows<{ content: string; userId: number }>(connection, 'SELECT * FROM posts');
      assert.equal(post.content, 'Conteúdo'); assert.equal(post.userId, 1);
      const [backup] = await rows<{ author: string; avatar: string }>(connection, 'SELECT author,avatar FROM swiftline_post_author_backup WHERE postId=1');
      assert.equal(backup.author, 'Nome antigo'); assert.equal(backup.avatar, 'foto-antiga');
      assert.equal((await databaseStatus(connection)).ready, true);
    });
    await t.test('cópia da base local mantém todas as linhas e definições após adoção', {
      skip: !process.env.SWIFTLINE_DATABASE_SNAPSHOT,
    }, async () => {
      await reset();
      const saved = JSON.parse(fs.readFileSync(process.env.SWIFTLINE_DATABASE_SNAPSHOT!, 'utf8')) as { tables: Record<string, { create: string; rows: Record<string, unknown>[]; columns: Record<string, { type: string }> }> };
      await connection.query('SET FOREIGN_KEY_CHECKS=0');
      try {
        for (const table of Object.values(saved.tables)) await connection.query(table.create);
        for (const [name, table] of Object.entries(saved.tables)) for (const row of table.rows) {
          const columns = Object.keys(row);
          const values = columns.map((column) => /^(DATE|DATETIME|TIMESTAMP)/.test(table.columns[column].type) && row[column] ? new Date(String(row[column])) : row[column]);
          await connection.query(`INSERT INTO ${quote(name)} (${columns.map(quote).join(',')}) VALUES (${columns.map(() => '?').join(',')})`, values);
        }
      } finally { await connection.query('SET FOREIGN_KEY_CHECKS=1'); }
      const before = await snapshot();
      await adoptDatabase(connection);
      await migrateDatabase(connection, migrations.slice(0, 4));
      const after = await snapshot();
      for (const [name, table] of Object.entries(before)) assert.deepEqual(after[name], table);
      assert.equal((await databaseStatus(connection, migrations.slice(0, 4))).ready, true);
      await migrateDatabase(connection);
      await startAndStop(true);
      assert.equal((await databaseStatus(connection)).ready, true);
    });
  } finally { await connection.end(); }
});
