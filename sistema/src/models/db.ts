import { Sequelize } from 'sequelize';

const sequelize = new Sequelize(
  process.env.DB_NAME ?? 'swiftline',
  process.env.DB_USER ?? 'root',
  process.env.DB_PASSWORD ?? '1234',
  { host: process.env.DB_HOST ?? 'localhost', dialect: 'mysql', logging: false }
);

export default sequelize;