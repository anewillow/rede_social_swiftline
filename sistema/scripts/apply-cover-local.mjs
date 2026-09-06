import 'dotenv/config';
import { createRequire } from 'node:module';
import sequelizePackage from 'sequelize';

const require = createRequire(import.meta.url);
const databaseModule = require('../dist/src/models/db.js');
const sequelize = databaseModule.default;
const { DataTypes } = sequelizePackage;

try {
  await sequelize.authenticate();
  const queryInterface = sequelize.getQueryInterface();
  const tables = await queryInterface.showAllTables();
  const usersTableExists = tables.some((table) => {
    const tableName = typeof table === 'string' ? table : Object.values(table)[0];
    return String(tableName).toLowerCase() === 'users';
  });

  if (usersTableExists) {
    const columns = await queryInterface.describeTable('Users');
    if (!columns.cover) {
      await queryInterface.addColumn('Users', 'cover', {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: ''
      });
      console.log('Coluna Users.cover criada.');
    }
  }
} finally {
  await sequelize.close();
}
