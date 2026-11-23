import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createConnection, type Connection } from 'mysql2/promise';
import { databaseOptions } from '../../config/database-options.js';
import { assertDataIntegrity, EXPECTED_SCHEMA_VERSION, inspectSchema, migrationDirectory, quote, rows, schemaDifferences } from './schema-inspection.js';

export const HISTORY_TABLE = 'swiftline_schema_migrations';
export type Migration = { id: string; checksum: string; up: (context: MigrationContext) => Promise<void> };
export type MigrationContext = {
  query: (statement: string, values?: unknown[]) => Promise<unknown>;
  table: (name: string) => Promise<string | undefined>;
  columns: (name: string) => Promise<Record<string, unknown>>;
};
type History = { version: string; checksum: string; state: 'running' | 'applied' | 'failed'; mode: string };
export type DatabaseStatus = { ready: boolean; applied: string[]; pending: string[]; issues: string[] };

export function loadMigrations(): Migration[] {
  const directory = migrationDirectory();
  const contract = fs.readFileSync(path.join(directory, 'schema-contract.json'), 'utf8').replaceAll('\r\n', '\n');
  const files = fs.readdirSync(directory).filter((file) => file.endsWith('.js')).sort();
  if (files.length !== EXPECTED_SCHEMA_VERSION) throw new Error('A entrega não contém a sequência completa de migrações.');
  return files.map((file, index) => {
    if (!file.startsWith(String(index + 1).padStart(4, '0') + '-') || !/^\d{4}-[a-z-]+\.js$/.test(file)) throw new Error('A sequência de migrações não é contínua: ' + file);
    const source = fs.readFileSync(path.join(directory, file), 'utf8').replaceAll('\r\n', '\n');
    const migration = require(path.join(directory, file)) as { up: Migration['up']; contractFile?: string };
    if (typeof migration.up !== 'function') throw new Error('Migração sem operação up: ' + file);
    if (migration.contractFile && !/^[a-z-]+\.json$/.test(migration.contractFile)) throw new Error('Nome de contrato de migração inválido.');
    const extra = migration.contractFile ? '\n' + fs.readFileSync(path.join(directory, migration.contractFile), 'utf8').replaceAll('\r\n', '\n') : '';
    return { id: file, checksum: createHash('sha256').update(contract + '\n' + source + extra).digest('hex'), up: migration.up };
  });
}

export function connectForMigrations(): Promise<Connection> {
  return createConnection({ ...databaseOptions(), charset: 'utf8mb4', timezone: 'Z', multipleStatements: false });
}

async function history(connection: Connection): Promise<History[]> {
  const tables = await rows<{ name: string }>(connection, 'SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?', [HISTORY_TABLE]);
  if (!tables.length) return [];
  return rows<History>(connection, `SELECT version, checksum, state, mode FROM ${quote(HISTORY_TABLE)} ORDER BY version`);
}

function historyIssues(records: History[], migrations: Migration[]): string[] {
  const issues: string[] = [];
  records.forEach((record, index) => {
    const expected = migrations[index];
    if (!expected || record.version !== expected.id) issues.push('Histórico fora da sequência: ' + record.version);
    else if (record.checksum !== expected.checksum) issues.push('Arquivo de migração alterado depois do registro: ' + record.version);
    if (record.state !== 'applied') issues.push('Migração incompleta: ' + record.version + ' (' + record.state + ')');
  });
  return issues;
}

export async function databaseStatus(connection: Connection, migrations = loadMigrations()): Promise<DatabaseStatus> {
  const records = await history(connection);
  const applied = records.filter((record) => record.state === 'applied').map((record) => record.version);
  const pending = migrations.filter((migration) => !applied.includes(migration.id)).map((migration) => migration.id);
  const issues = historyIssues(records, migrations);
  if (!records.length) issues.push('Banco sem versão registrada. Banco vazio: npm run db:migrate. Banco existente: npm run db:adopt e depois npm run db:migrate.');
  if (pending.length) issues.push('Há atualizações pendentes. Execute npm run db:migrate com o servidor parado.');
  issues.push(...schemaDifferences(await inspectSchema(connection), migrations.length));
  return { ready: issues.length === 0, applied, pending, issues };
}

async function createHistory(connection: Connection): Promise<void> {
  await connection.query(`CREATE TABLE IF NOT EXISTS ${quote(HISTORY_TABLE)} (version VARCHAR(255) NOT NULL PRIMARY KEY, checksum CHAR(64) NOT NULL, state ENUM('running','applied','failed') NOT NULL, mode VARCHAR(20) NOT NULL, startedAt DATETIME NOT NULL, appliedAt DATETIME NULL, failure VARCHAR(100) NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

async function locked<T>(connection: Connection, operation: () => Promise<T>): Promise<T> {
  const [database] = await rows<{ name: string }>(connection, 'SELECT DATABASE() AS name');
  const key = 'swiftline:migrate:' + createHash('sha256').update(database.name).digest('hex').slice(0, 40);
  const [lock] = await rows<{ acquired: number }>(connection, 'SELECT GET_LOCK(?, 0) AS acquired', [key]);
  if (Number(lock.acquired) !== 1) throw new Error('Outra atualização do banco está em andamento. Tente depois que ela terminar.');
  try { return await operation(); }
  finally { await connection.query('SELECT RELEASE_LOCK(?)', [key]); }
}

function context(connection: Connection): MigrationContext {
  return {
    query: async (statement, values = []) => (await connection.query(statement, values))[0],
    table: async (name) => (await inspectSchema(connection))[name.toLowerCase()]?.name,
    columns: async (name) => (await inspectSchema(connection))[name.toLowerCase()]?.columns ?? {},
  };
}

export async function adoptDatabase(connection: Connection, migrations = loadMigrations()): Promise<void> {
  await locked(connection, async () => {
    if ((await history(connection)).length) throw new Error('O banco já tem histórico. Use npm run db:migrate.');
    const schema = await inspectSchema(connection);
    const differences = schemaDifferences(schema, 1, true);
    if (differences.length) throw new Error('A base existente não equivale à versão inicial:\n' + differences.join('\n'));
    await assertDataIntegrity(connection, schema);
    await createHistory(connection);
    await connection.query(`INSERT INTO ${quote(HISTORY_TABLE)} (version,checksum,state,mode,startedAt,appliedAt) VALUES (?,?,'applied','adopted',NOW(),NOW())`, [migrations[0].id, migrations[0].checksum]);
  });
}

export async function migrateDatabase(connection: Connection, migrations = loadMigrations()): Promise<string[]> {
  return locked(connection, async () => {
    let records = await history(connection);
    if (historyIssues(records.map((record) => ({ ...record, state: 'applied' })), migrations).length) throw new Error('O histórico não corresponde aos arquivos. Nenhuma migração foi executada.');
    if (records.some((record, index) => record.state !== 'applied' && index !== records.length - 1)) throw new Error('Há uma falha no meio do histórico. Confira a sequência antes de continuar.');
    if (!records.length) {
      const existing = await inspectSchema(connection);
      if (Object.keys(existing).some((table) => table !== HISTORY_TABLE)) throw new Error('O banco já contém tabelas. Confira e registre a base com npm run db:adopt.');
    } else {
      const lastComplete = records.filter((record) => record.state === 'applied').length;
      // A failed DDL may have completed only part of its own step. Its idempotent up resumes it.
      if (lastComplete && records.every((record) => record.state === 'applied')) {
        const differences = schemaDifferences(await inspectSchema(connection), lastComplete, true);
        if (differences.length) throw new Error('O esquema mudou fora das migrações:\n' + differences.join('\n'));
      }
    }
    await createHistory(connection);
    const executed: string[] = [];
    for (const [index, migration] of migrations.entries()) {
      const record = records.find((item) => item.version === migration.id);
      if (record?.state === 'applied') continue;
      await connection.query(`INSERT INTO ${quote(HISTORY_TABLE)} (version,checksum,state,mode,startedAt) VALUES (?,?,'running','migrated',NOW()) ON DUPLICATE KEY UPDATE state='running',startedAt=NOW(),failure=NULL`, [migration.id, migration.checksum]);
      try {
        await migration.up(context(connection));
        const differences = schemaDifferences(await inspectSchema(connection), index + 1, true);
        if (differences.length) throw new Error('Estrutura incompatível após a migração:\n' + differences.join('\n'));
        await connection.query(`UPDATE ${quote(HISTORY_TABLE)} SET state='applied',appliedAt=NOW(),failure=NULL WHERE version=?`, [migration.id]);
        executed.push(migration.id);
      } catch (error) {
        await connection.query(`UPDATE ${quote(HISTORY_TABLE)} SET state='failed',failure='Migration failed; inspect and retry' WHERE version=?`, [migration.id]);
        throw new Error('Falha em ' + migration.id + '. O MySQL pode ter confirmado parte do DDL; confira a base e execute novamente.\n' + (error instanceof Error ? error.message : 'Falha desconhecida.'));
      }
    }
    const status = await databaseStatus(connection, migrations);
    if (!status.ready) throw new Error(status.issues.join('\n'));
    return executed;
  });
}

export async function assertDatabaseReady(): Promise<void> {
  const connection = await connectForMigrations();
  try {
    const status = await databaseStatus(connection);
    if (!status.ready) throw new Error('O servidor não abriu porque o banco precisa de atenção:\n' + status.issues.join('\n'));
  } finally { await connection.end(); }
}
