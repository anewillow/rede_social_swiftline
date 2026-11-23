'use strict';

const BACKUP_TABLE = 'swiftline_post_author_backup';
const VERSION = '20261120000000';
const legacyFields = ['author', 'avatar'];
const tableNames = async (qi) => (await qi.showAllTables()).map((table) => typeof table === 'string' ? table : Object.values(table)[0]);
const quote = (qi, name) => qi.queryGenerator.quoteIdentifier(name);

async function inspect(qi) {
  const tables = await tableNames(qi);
  const posts = tables.find((name) => name.toLowerCase() === 'posts');
  const users = tables.find((name) => name.toLowerCase() === 'users');
  if (!posts) return { exists: false, fields: [], total: 0, missingAuthors: 0, backupExists: tables.includes(BACKUP_TABLE) };
  const columns = await qi.describeTable(posts);
  const fields = legacyFields.filter((field) => columns[field]);
  if (!users || !columns.userId) throw new Error('A tabela de usuários e a referência userId são necessárias antes da migração.');
  const [rows] = await qi.sequelize.query(
    `SELECT COUNT(*) AS total, COALESCE(SUM(u.id IS NULL), 0) AS missingAuthors FROM ${quote(qi, posts)} p LEFT JOIN ${quote(qi, users)} u ON p.userId = u.id`,
  );
  return { exists: true, posts, users, columns, fields, total: Number(rows[0].total), missingAuthors: Number(rows[0].missingAuthors), backupExists: tables.includes(BACKUP_TABLE) };
}

async function readMetadata(qi) {
  const [rows] = await qi.sequelize.query(`SELECT metadata FROM ${quote(qi, BACKUP_TABLE)} WHERE ${quote(qi, 'key')} = 'schema'`);
  if (!rows.length) return null;
  const metadata = JSON.parse(rows[0].metadata);
  if (metadata.version !== VERSION) throw new Error('A tabela de backup pertence a outra migração.');
  return metadata;
}

async function up(qi, Sequelize) {
  const state = await inspect(qi);
  if (!state.exists || !state.fields.length) return { changed: false, total: state.total, backupTable: state.backupExists ? BACKUP_TABLE : null };
  if (state.missingAuthors) throw new Error(`Existem ${state.missingAuthors} publicações sem usuário válido. Nenhuma coluna foi removida.`);
  let metadata;
  if (state.backupExists) {
    metadata = await readMetadata(qi);
    if (!metadata) throw new Error('Existe uma tabela de backup sem metadados; ela foi preservada para conferência.');
    if (metadata.posts !== state.posts) throw new Error('O backup não corresponde à tabela atual de publicações.');
    const comparisons = state.fields.map((field) => `NOT (p.${quote(qi, field)} <=> b.${quote(qi, field)})`);
    const [changed] = await qi.sequelize.query(
      `SELECT COUNT(*) AS total FROM ${quote(qi, state.posts)} p LEFT JOIN ${quote(qi, BACKUP_TABLE)} b ON p.id = b.postId WHERE b.postId IS NULL OR NOT (p.userId <=> b.userId) OR ${comparisons.join(' OR ')}`,
    );
    const [count] = await qi.sequelize.query(`SELECT COUNT(*) AS total FROM ${quote(qi, BACKUP_TABLE)} WHERE postId IS NOT NULL`);
    if (Number(changed[0].total) || Number(count[0].total) !== state.total)
      throw new Error('Os dados mudaram depois do backup. O backup existente foi preservado e nenhuma coluna foi removida.');
  } else {
    metadata = { version: VERSION, posts: state.posts, users: state.users, status: 'prepared', columns: Object.fromEntries(state.fields.map((field) => [field, state.columns[field]])) };
    await qi.createTable(BACKUP_TABLE, {
      key: { type: Sequelize.STRING(64), primaryKey: true, allowNull: false },
      postId: { type: Sequelize.INTEGER, allowNull: true },
      userId: { type: Sequelize.INTEGER, allowNull: true },
      author: { type: Sequelize.TEXT, allowNull: true },
      avatar: { type: Sequelize.TEXT('long'), allowNull: true },
      metadata: { type: Sequelize.TEXT('long'), allowNull: true },
    });
    await qi.sequelize.transaction(async (transaction) => {
      await qi.bulkInsert(BACKUP_TABLE, [{ key: 'schema', metadata: JSON.stringify(metadata) }], { transaction });
      const author = state.columns.author ? quote(qi, 'author') : 'NULL';
      const avatar = state.columns.avatar ? quote(qi, 'avatar') : 'NULL';
      await qi.sequelize.query(
        `INSERT INTO ${quote(qi, BACKUP_TABLE)} (${quote(qi, 'key')}, postId, userId, author, avatar) SELECT CONCAT('post:', id), id, userId, ${author}, ${avatar} FROM ${quote(qi, state.posts)}`,
        { transaction },
      );
    });
  }

  await qi.sequelize.query(`ALTER TABLE ${quote(qi, state.posts)} ${state.fields.map((field) => 'DROP COLUMN ' + quote(qi, field)).join(', ')}`);
  await qi.bulkUpdate(BACKUP_TABLE, { metadata: JSON.stringify({ ...metadata, status: 'applied' }) }, { key: 'schema' });
  return { changed: true, total: state.total, backupTable: BACKUP_TABLE };
}

function definition(info, Sequelize, allowNull = info.allowNull) {
  const type = info.type.toUpperCase();
  const varchar = type.match(/^VARCHAR\((\d+)\)$/);
  const dataType = varchar ? Sequelize.STRING(Number(varchar[1]))
    : type === 'LONGTEXT' ? Sequelize.TEXT('long')
    : type === 'MEDIUMTEXT' ? Sequelize.TEXT('medium')
    : type === 'TEXT' ? Sequelize.TEXT : null;
  if (!dataType) throw new Error('Tipo de coluna não suportado na restauração: ' + type);
  return { type: dataType, allowNull, ...(info.defaultValue != null ? { defaultValue: info.defaultValue } : {}) };
}

async function down(qi, Sequelize) {
  if (!(await tableNames(qi)).includes(BACKUP_TABLE)) throw new Error('Não existe backup desta migração para restaurar.');
  const metadata = await readMetadata(qi);
  if (!metadata) throw new Error('O backup não tem os metadados necessários para restaurar.');
  const columns = await qi.describeTable(metadata.posts);
  for (const [field, info] of Object.entries(metadata.columns)) {
    if (!legacyFields.includes(field)) throw new Error('Campo inesperado no backup.');
    if (!columns[field]) await qi.addColumn(metadata.posts, field, definition(info, Sequelize, true));
  }
  const fields = Object.keys(metadata.columns);
  const current = fields.map((field) => `p.${quote(qi, field)} = ${field === 'author' ? "COALESCE(u.username, 'Usuário indisponível')" : 'u.avatar'}`);
  await qi.sequelize.query(`UPDATE ${quote(qi, metadata.posts)} p LEFT JOIN ${quote(qi, metadata.users)} u ON p.userId = u.id SET ${current.join(', ')}`);
  await qi.sequelize.query(`UPDATE ${quote(qi, metadata.posts)} p JOIN ${quote(qi, BACKUP_TABLE)} b ON p.id = b.postId AND p.userId = b.userId SET ${fields.map((field) => `p.${quote(qi, field)} = b.${quote(qi, field)}`).join(', ')}`);
  for (const [field, info] of Object.entries(metadata.columns)) await qi.changeColumn(metadata.posts, field, definition(info, Sequelize));
  await qi.dropTable(BACKUP_TABLE);
  return { restored: true };
}

module.exports = { up, down, inspect, BACKUP_TABLE };
