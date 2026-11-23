'use strict';
module.exports = { up: async ({ query, table, columns }) => {
  const users = await table('users');
  if (!(await columns('users')).cover) await query('ALTER TABLE `' + users + '` ADD COLUMN `cover` VARCHAR(255) NULL DEFAULT \'\'');
} };
