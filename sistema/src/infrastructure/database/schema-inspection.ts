import fs from 'node:fs';
import path from 'node:path';
import type { Connection, RowDataPacket } from 'mysql2/promise';

export type Column = { type: string; allowNull: boolean; defaultValue: unknown; autoIncrement: boolean };
export type Index = { primary: boolean; fields: string[] };
export type Reference = { column: string; table: string; key: string; onDelete: string; onUpdate: string };
export type TableSchema = { name: string; columns: Record<string, Column>; indexes: Index[]; references: Reference[]; engine?: string; charset?: string };
export type Schema = Record<string, TableSchema>;
export const EXPECTED_SCHEMA_VERSION = 6;
export const quote = (name: string) => '`' + name.replaceAll('`', '``') + '`';

export function migrationDirectory(): string {
  let directory = __dirname;
  while (true) {
    const candidate = path.join(directory, 'migrations/current');
    if (fs.existsSync(path.join(candidate, 'schema-contract.json'))) return candidate;
    const parent = path.dirname(directory);
    if (parent === directory) throw new Error('A sequência de migrações não foi encontrada.');
    directory = parent;
  }
}

export async function rows<T>(connection: Connection, sql: string, values: unknown[] = []): Promise<T[]> {
  const [result] = await connection.query<RowDataPacket[]>(sql, values);
  return result as T[];
}

export function expectedSchema(version = EXPECTED_SCHEMA_VERSION): Schema {
  const schema: Schema = JSON.parse(fs.readFileSync(path.join(migrationDirectory(), 'schema-contract.json'), 'utf8'));
  if (version < 2) delete schema.users.columns.cover;
  if (version < 3) { delete schema.poll_options; delete schema.poll_votes; }
  if (version >= 5) Object.assign(schema, JSON.parse(fs.readFileSync(path.join(migrationDirectory(), 'storage-contract.json'), 'utf8')));
  if (version >= 6) {
    const fields = JSON.parse(fs.readFileSync(path.join(migrationDirectory(), 'api-schema-contract.json'), 'utf8'));
    schema.posts.columns.content = fields.content;
    schema.users.columns.location = fields.location; schema.users.columns.website = fields.website;
  }
  return schema;
}

export async function inspectSchema(connection: Connection): Promise<Schema> {
  const schema: Schema = {};
  const tables = await rows<{ name: string; engine: string; collation: string }>(connection,
    'SELECT TABLE_NAME AS name, ENGINE AS engine, TABLE_COLLATION AS collation FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = \'BASE TABLE\'');
  for (const table of tables) {
    const key = table.name.toLowerCase();
    const columns = await rows<{ name: string; type: string; nullable: string; value: unknown; extra: string }>(connection,
      'SELECT COLUMN_NAME AS name, COLUMN_TYPE AS type, IS_NULLABLE AS nullable, COLUMN_DEFAULT AS value, EXTRA AS extra FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION', [table.name]);
    const indexes = await rows<{ name: string; nonUnique: number; column: string; prefix: number | null }>(connection,
      'SELECT INDEX_NAME AS name, NON_UNIQUE AS nonUnique, COLUMN_NAME AS `column`, SUB_PART AS prefix FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY INDEX_NAME, SEQ_IN_INDEX', [table.name]);
    const keys = new Map<string, Index>();
    for (const index of indexes) {
      if (Number(index.nonUnique)) continue;
      if (!keys.has(index.name)) keys.set(index.name, { primary: index.name === 'PRIMARY', fields: [] });
      keys.get(index.name)!.fields.push(index.column + (index.prefix ? ':' + index.prefix : ''));
    }
    const references = await rows<Reference>(connection,
      'SELECT k.COLUMN_NAME AS `column`, LOWER(k.REFERENCED_TABLE_NAME) AS `table`, k.REFERENCED_COLUMN_NAME AS `key`, r.DELETE_RULE AS onDelete, r.UPDATE_RULE AS onUpdate FROM information_schema.KEY_COLUMN_USAGE k JOIN information_schema.REFERENTIAL_CONSTRAINTS r ON k.CONSTRAINT_SCHEMA=r.CONSTRAINT_SCHEMA AND k.TABLE_NAME=r.TABLE_NAME AND k.CONSTRAINT_NAME=r.CONSTRAINT_NAME WHERE k.TABLE_SCHEMA=DATABASE() AND k.TABLE_NAME=? AND k.REFERENCED_TABLE_NAME IS NOT NULL', [table.name]);
    schema[key] = {
      name: table.name, engine: table.engine, charset: table.collation?.split('_')[0], references,
      columns: Object.fromEntries(columns.map((column) => [column.name, { type: column.type, allowNull: column.nullable === 'YES', defaultValue: column.value, autoIncrement: column.extra.includes('auto_increment') }])),
      indexes: [...keys.values()],
    };
  }
  return schema;
}

const typeKey = (type: string) => type.toLowerCase().replace(/\bint\(\d+\)/g, 'int').replace(/tinyint\(1\)/g, 'tinyint');
const defaultKey = (value: unknown) => value == null ? null : String(value);
const indexKey = (index: Index) => JSON.stringify([index.primary, index.fields]);
const referenceKey = (reference: Reference) => JSON.stringify([reference.column, reference.table.toLowerCase(), reference.key, reference.onDelete.replace('NO ACTION', 'RESTRICT'), reference.onUpdate.replace('NO ACTION', 'RESTRICT')]);

export function schemaDifferences(actual: Schema, version = EXPECTED_SCHEMA_VERSION, allowAhead = false): string[] {
  const expected = expectedSchema(version);
  const latest = expectedSchema();
  const differences: string[] = [];
  for (const [key, wanted] of Object.entries(expected)) {
    const found = actual[key];
    if (!found) { differences.push('Tabela ausente: ' + wanted.name); continue; }
    if (found.engine !== 'InnoDB' || found.charset !== 'utf8mb4') differences.push('Engine ou charset incompatível: ' + wanted.name);
    const compared = { ...wanted.columns };
    if (allowAhead && key === 'users' && found.columns.cover) compared.cover = latest.users.columns.cover;
    for (const [name, column] of Object.entries(compared)) {
      const current = found.columns[name];
      if (!current) { differences.push('Coluna ausente: ' + wanted.name + '.' + name); continue; }
      if (typeKey(current.type) !== typeKey(column.type) || current.allowNull !== column.allowNull || current.autoIncrement !== column.autoIncrement || defaultKey(current.defaultValue) !== defaultKey(column.defaultValue))
        differences.push('Definição incompatível: ' + wanted.name + '.' + name);
    }
    for (const name of Object.keys(found.columns)) {
      if (compared[name]) continue;
      if (key === 'posts' && version < 4 && ['author', 'avatar'].includes(name) && /^(varchar\(\d+\)|text|mediumtext|longtext)$/i.test(found.columns[name].type)) continue;
      differences.push('Coluna fora da versão esperada: ' + wanted.name + '.' + name);
    }
    const wantedIndexes = new Set(wanted.indexes.map(indexKey));
    const foundIndexes = new Set(found.indexes.map(indexKey));
    for (const index of wantedIndexes) if (!foundIndexes.has(index)) differences.push('Chave obrigatória ausente: ' + wanted.name + ' ' + index);
    for (const index of foundIndexes) {
      if (!wantedIndexes.has(index) && !(allowAhead && key === 'users' && latest.users.indexes.some((value) => indexKey(value) === index)))
        differences.push('Restrição única inesperada: ' + wanted.name + ' ' + index);
    }
    const wantedRefs = new Set(wanted.references.map(referenceKey));
    const foundRefs = new Set(found.references.map(referenceKey));
    for (const reference of wantedRefs) if (!foundRefs.has(reference)) differences.push('Relacionamento ausente ou incompatível: ' + wanted.name + ' ' + reference);
    for (const reference of foundRefs) if (!wantedRefs.has(reference)) differences.push('Relacionamento inesperado: ' + wanted.name + ' ' + reference);
  }
  if (allowAhead && version < 3) {
    for (const key of ['poll_options', 'poll_votes']) {
      if (!actual[key]) continue;
      // Validate already-present poll tables with their complete contract.
      const required = expectedSchema(3);
      const subset = { ...actual, ...Object.fromEntries(Object.entries(required).filter(([name]) => name !== key)) };
      differences.push(...schemaDifferences(subset, 3, true).filter((difference) => difference.includes(latest[key].name)));
    }
  }
  return differences;
}

export async function assertDataIntegrity(connection: Connection, schema: Schema): Promise<void> {
  for (const table of Object.values(schema)) {
    if (!expectedSchema()[table.name.toLowerCase()]) continue;
    for (const reference of table.references) {
      const target = schema[reference.table];
      if (!target) throw new Error('Tabela referenciada ausente: ' + reference.table);
      const invalid = await rows(connection, `SELECT 1 FROM ${quote(table.name)} a LEFT JOIN ${quote(target.name)} b ON a.${quote(reference.column)}=b.${quote(reference.key)} WHERE a.${quote(reference.column)} IS NOT NULL AND b.${quote(reference.key)} IS NULL LIMIT 1`);
      if (invalid.length) throw new Error('Há referências inválidas em ' + table.name + '.' + reference.column + '. Nenhuma versão foi registrada.');
    }
  }
}
