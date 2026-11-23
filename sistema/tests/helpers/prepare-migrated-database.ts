import assert from 'node:assert/strict';
import path from 'node:path';
import { connectForMigrations, migrateDatabase } from '../../src/infrastructure/database/migrations.js';
import { rows } from '../../src/infrastructure/database/schema-inspection.js';

export async function prepareMigratedTestDatabase(): Promise<void> {
  assert.ok(process.env.SWIFTLINE_DISPOSABLE_MYSQL, 'A preparação de teste exige uma instância descartável.');
  assert.equal(process.env.DB_HOST, '127.0.0.1');
  const connection = await connectForMigrations();
  try {
    const [location] = await rows<{ directory: string }>(connection, 'SELECT @@datadir AS directory');
    assert.equal(path.resolve(location.directory).toLowerCase(), path.resolve(process.env.SWIFTLINE_DISPOSABLE_MYSQL).toLowerCase());
    await migrateDatabase(connection);
  } finally { await connection.end(); }
}
