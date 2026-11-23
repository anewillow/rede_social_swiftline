import 'dotenv/config';
import app from './app.js';
import sequelize from './config/database.js';
import { assertDatabaseReady } from './infrastructure/database/migrations.js';
import { startImageMaintenance } from './infrastructure/storage/file-cleanup.js';

const port = Number(process.env.PORT ?? 3000);

async function startServer(): Promise<void> {
  try {
    await sequelize.authenticate();
    console.log('MySQL conectado');
    await assertDatabaseReady();
    startImageMaintenance();
    app.listen(port, () => console.log(`Swiftline está online em http://localhost:${port}`));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Falha ao iniciar o Swiftline.');
    await sequelize.close();
    process.exitCode = 1;
  }
}

void startServer();
