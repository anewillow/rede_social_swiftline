import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const suites = {
  'api-contracts': { prefix: 'swiftline-contracts-mysql-', schema: 'swiftline_contracts_test', file: 'api-contracts.mysql.test.js', report: 'api-contracts-mysql.json', ui: true },
  'account-deletion': { prefix: 'swiftline-case1-mysql-', schema: 'swiftline_case1_test', file: 'account-deletion.mysql.test.js', report: 'account-deletion-mysql.json', ui: false },
  'post-authors': { prefix: 'swiftline-authors-mysql-', schema: 'swiftline_authors_test', file: 'post-authors.mysql.test.js', report: 'post-authors-mysql.json', ui: true },
  'post-interface': { prefix: 'swiftline-posts-mysql-', schema: 'swiftline_posts_test', file: 'post-interface.mysql.test.js', report: 'post-interface-mysql.json', ui: true },
  'database-migrations': { prefix: 'swiftline-database-mysql-', schema: 'swiftline_database_test', file: 'database-migrations.mysql.test.js', report: 'database-migrations-mysql.json', ui: true },
  'atomic-operations': { prefix: 'swiftline-atomic-mysql-', schema: 'swiftline_atomic_test', file: 'atomic-operations.mysql.test.js', report: 'atomic-operations-mysql.json', ui: false },
};
const suiteName = process.argv[2] || 'account-deletion';
assert.ok(Object.hasOwn(suites, suiteName), 'Suíte MySQL desconhecida.');
const suite = suites[suiteName];
const { prefix, schema, file: testFile } = suite;
const located = process.env.MYSQLD_BINARY || spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', ['mysqld'], { encoding: 'utf8', windowsHide: true }).stdout?.trim().split(/\r?\n/)[0];
assert.ok(located, 'MySQL não encontrado. Defina MYSQLD_BINARY com o caminho de mysqld.');
const binary = path.resolve(located);
const directory = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
const data = path.join(directory, 'data');
const mysqlLog = path.join(directory, 'mysql.log');
const reportPath = path.join(project, 'test-results', suite.report);
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let engine;
let connection;
let testOutput = '';
let passed = false;

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, ...options, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; if (options.forward) process.stdout.write(chunk); });
    child.stderr.on('data', (chunk) => { output += chunk; if (options.forward) process.stderr.write(chunk); });
    child.once('error', reject);
    child.once('close', (code) => code === 0 ? resolve(output) : reject(new Error('Comando de teste terminou com código ' + code + '\n' + output.slice(-6000))));
  });
}

function normalized(value) {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

try {
  await fs.mkdir(path.join(directory, 'tmp'));
  if (suite.ui) await fs.cp(path.join(project, 'client-dist'), path.join(directory, 'client-dist'), { recursive: true });
  console.log('Prepara uma instância MySQL exclusiva para a suíte ' + suiteName + '.');
  await run(binary, [
    '--no-defaults', '--initialize-insecure',
    '--basedir=' + path.dirname(path.dirname(binary)), '--datadir=' + data,
    '--log-error=' + mysqlLog,
  ]);

  const listener = net.createServer();
  listener.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const port = listener.address().port;
  await new Promise((resolve) => listener.close(resolve));

  engine = spawn(binary, [
    '--no-defaults', '--basedir=' + path.dirname(path.dirname(binary)), '--datadir=' + data,
    '--bind-address=127.0.0.1', '--port=' + port, '--mysqlx=OFF', '--skip-log-bin',
    '--innodb-buffer-pool-size=32M', '--max-connections=20', '--performance-schema=OFF',
    '--tmpdir=' + path.join(directory, 'tmp'), '--log-error=' + mysqlLog,
    '--pid-file=' + path.join(directory, 'mysql.pid'),
  ], { windowsHide: true, stdio: 'ignore' });
  let spawnError;
  engine.once('error', (error) => { spawnError = error; });
  process.once('exit', () => { if (engine?.exitCode === null) engine.kill(); });

  const deadline = Date.now() + 45000;
  while (!connection && Date.now() < deadline) {
    if (spawnError) throw spawnError;
    if (engine.exitCode !== null) throw new Error('A instância temporária encerrou antes de aceitar conexões.');
    try {
      connection = await mysql.createConnection({ host: '127.0.0.1', port, user: 'root', password: '', connectTimeout: 500 });
    } catch { await pause(250); }
  }
  assert.ok(connection, 'A instância temporária não respondeu dentro do prazo.');
  const [location] = await connection.query('SELECT @@datadir AS directory, VERSION() AS version');
  assert.equal(normalized(location[0].directory), normalized(data), 'A conexão não pertence ao banco temporário.');
  await connection.query('CREATE DATABASE ' + schema + ' CHARACTER SET utf8mb4');

  console.log('Executa a suíte no MySQL temporário.');
  testOutput = await run(process.execPath, ['--test', path.join(project, 'dist/tests/integration', testFile)], {
    cwd: directory,
    env: {
      ...process.env,
      DB_HOST: '127.0.0.1', DB_PORT: String(port), DB_USER: 'root', DB_PASSWORD: '', DB_NAME: schema,
      SWIFTLINE_DISPOSABLE_MYSQL: data,
      SWIFTLINE_MYSQL_SUITE: suiteName,
    },
    forward: true,
  });
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify({
    database: 'MySQL', version: location[0].version, isolated: true, passed: true, output: testOutput,
  }, null, 2));
  passed = true;
} catch (error) {
  try { console.error((await fs.readFile(mysqlLog, 'utf8')).slice(-4500)); } catch {}
  throw error;
} finally {
  if (connection) {
    try { await connection.query('SHUTDOWN'); } catch {}
    try { await connection.end(); } catch {}
  }
  if (engine?.exitCode === null) {
    await Promise.race([once(engine, 'exit'), pause(5000)]);
    if (engine.exitCode === null) { engine.kill(); await Promise.race([once(engine, 'exit'), pause(3000)]); }
  }
  if (passed && (!engine || engine.exitCode !== null)) {
    // A remoção fica restrita à pasta criada por mkdtemp, dentro do temporário do usuário.
    const actual = await fs.realpath(directory);
    const temporaryRoot = await fs.realpath(os.tmpdir());
    assert.ok(normalized(actual).startsWith(normalized(temporaryRoot) + path.sep));
    assert.ok(path.basename(actual).startsWith(prefix));
    await fs.rm(actual, { recursive: true });
    console.log('Instância de teste encerrada e diretório temporário removido.');
  } else console.error('Arquivos de diagnóstico preservados em: ' + directory);
}
