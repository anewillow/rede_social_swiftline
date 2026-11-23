export function databaseOptions() {
  const port = Number(process.env.DB_PORT ?? 3306);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('DB_PORT deve ser uma porta válida.');
  const database = process.env.DB_NAME ?? 'swiftline';
  if (!database.trim()) throw new Error('DB_NAME não pode ficar vazio.');
  return {
    host: process.env.DB_HOST ?? 'localhost', port, database,
    user: process.env.DB_USER ?? 'root', password: process.env.DB_PASSWORD ?? '1234',
  };
}
