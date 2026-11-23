'use strict';
const backup = 'swiftline_post_author_backup';
const quote = (name) => '`' + name.replaceAll('`', '``') + '`';
module.exports = { up: async ({ query, table, columns }) => {
  const posts = await table('posts'), users = await table('users');
  const definition = await columns('posts');
  const fields = ['author', 'avatar'].filter((field) => definition[field]);
  if (!fields.length) return;
  const [orphans] = await query(`SELECT COUNT(*) AS total FROM ${quote(posts)} p LEFT JOIN ${quote(users)} u ON p.userId=u.id WHERE u.id IS NULL`);
  if (Number(orphans.total)) throw new Error('Existem publicações sem usuário válido. Nenhuma coluna foi removida.');
  let metadata;
  if (await table(backup)) {
    const [saved] = await query(`SELECT metadata FROM ${quote(backup)} WHERE ${quote('key')}='schema'`);
    if (!saved) throw new Error('O backup existente não possui os metadados necessários.');
    metadata = JSON.parse(saved.metadata);
    if (metadata.version !== '20261120000000' || metadata.posts !== posts) throw new Error('O backup existente pertence a outra estrutura.');
    const differences = fields.map((field) => `NOT (p.${quote(field)} <=> b.${quote(field)})`).join(' OR ');
    const [changed] = await query(`SELECT COUNT(*) AS total FROM ${quote(posts)} p LEFT JOIN ${quote(backup)} b ON p.id=b.postId WHERE b.postId IS NULL OR NOT (p.userId <=> b.userId) OR ${differences}`);
    const [size] = await query(`SELECT (SELECT COUNT(*) FROM ${quote(posts)}) AS posts, (SELECT COUNT(*) FROM ${quote(backup)} WHERE postId IS NOT NULL) AS archived`);
    if (Number(changed.total) || Number(size.posts) !== Number(size.archived)) throw new Error('Os dados mudaram depois do backup. O backup foi preservado.');
  } else {
    metadata = { version: '20261120000000', posts, users, status: 'prepared', columns: Object.fromEntries(fields.map((field) => [field, definition[field]])) };
    await query(`CREATE TABLE ${quote(backup)} (${quote('key')} VARCHAR(64) NOT NULL PRIMARY KEY, postId INT NULL, userId INT NULL, author TEXT NULL, avatar LONGTEXT NULL, metadata LONGTEXT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await query('START TRANSACTION');
    try {
      await query(`INSERT INTO ${quote(backup)} (${quote('key')}, metadata) VALUES ('schema',?)`, [JSON.stringify(metadata)]);
      await query(`INSERT INTO ${quote(backup)} (${quote('key')},postId,userId,author,avatar) SELECT CONCAT('post:',id),id,userId,${definition.author ? quote('author') : 'NULL'},${definition.avatar ? quote('avatar') : 'NULL'} FROM ${quote(posts)}`);
      await query('COMMIT');
    } catch (error) { await query('ROLLBACK'); throw error; }
  }
  await query(`ALTER TABLE ${quote(posts)} ${fields.map((field) => 'DROP COLUMN ' + quote(field)).join(', ')}`);
  await query(`UPDATE ${quote(backup)} SET metadata=? WHERE ${quote('key')}='schema'`, [JSON.stringify({ ...metadata, status: 'applied' })]);
} };
