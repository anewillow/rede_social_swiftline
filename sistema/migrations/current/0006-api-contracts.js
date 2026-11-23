'use strict';
module.exports = { contractFile: 'api-schema-contract.json', up: async ({ query, table, columns }) => {
  const posts = await table('posts'), users = await table('users');
  if (String((await columns('posts')).content.type).toLowerCase() !== 'text') await query('ALTER TABLE `' + posts + '` MODIFY COLUMN content TEXT NULL');
  const profile = await columns('users');
  if (!profile.location) await query("ALTER TABLE `" + users + "` ADD COLUMN location VARCHAR(120) NULL DEFAULT ''");
  if (!profile.website) await query("ALTER TABLE `" + users + "` ADD COLUMN website VARCHAR(2048) NULL DEFAULT ''");
} };
