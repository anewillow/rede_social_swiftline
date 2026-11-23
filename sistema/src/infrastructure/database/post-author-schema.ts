import type { Sequelize } from 'sequelize';

export async function assertPostAuthorSchema(database: Sequelize): Promise<void> {
  const columns = await database.getQueryInterface().describeTable('posts');
  if (columns.author || columns.avatar)
    throw new Error('Atualize o banco com npm run db:migrate antes de iniciar esta versão.');
}
