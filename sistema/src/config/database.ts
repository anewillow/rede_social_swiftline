import { Sequelize } from 'sequelize';
import { databaseOptions } from './database-options.js';

const config = databaseOptions();
const sequelize = new Sequelize(config.database, config.user, config.password,
  { host: config.host, port: config.port, dialect: 'mysql', logging: false });

export default sequelize;
