import type { Sequelize, Transaction } from 'sequelize';
import type { AtomicUnitOfWork } from '../../workflows/ports/unit-of-work.js';

export function createSequelizeUnitOfWork<Scope>(
  database: Sequelize,
  createScope: (transaction: Transaction) => Scope,
): AtomicUnitOfWork<Scope> {
  return {
    async run(operation) {
      return database.transaction((transaction) => operation(createScope(transaction)));
    },
  };
}
