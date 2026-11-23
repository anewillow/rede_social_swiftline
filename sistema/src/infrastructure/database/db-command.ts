import 'dotenv/config';
import { adoptDatabase, connectForMigrations, databaseStatus, migrateDatabase } from './migrations.js';

async function main(): Promise<void> {
  const operation = process.argv[2];
  if (!['status', 'migrate', 'adopt'].includes(operation) || process.argv.length !== 3)
    throw new Error('Use npm run db:status, npm run db:migrate ou npm run db:adopt.');
  const connection = await connectForMigrations();
  try {
    if (operation === 'adopt') {
      await adoptDatabase(connection);
      console.log('Base existente conferida e versão inicial registrada. Execute npm run db:migrate.');
    } else if (operation === 'migrate') {
      const executed = await migrateDatabase(connection);
      console.log(executed.length ? 'Migrações aplicadas: ' + executed.join(', ') : 'O banco já está atualizado.');
    } else {
      const status = await databaseStatus(connection);
      console.log(JSON.stringify(status, null, 2));
      if (!status.ready) process.exitCode = 1;
    }
  } finally { await connection.end(); }
}

void main().catch((error) => { console.error(error instanceof Error ? error.message : 'Falha ao preparar o banco.'); process.exitCode = 1; });
