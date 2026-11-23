'use strict';
module.exports = { contractFile: 'storage-contract.json', up: async ({ query }) => {
  await query("CREATE TABLE IF NOT EXISTS file_cleanup_jobs (fileKey VARCHAR(120) NOT NULL PRIMARY KEY, attempts INT NOT NULL DEFAULT 0, availableAt DATETIME NOT NULL, lastError VARCHAR(100) NULL, createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
} };
