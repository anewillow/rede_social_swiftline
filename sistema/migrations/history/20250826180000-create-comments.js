"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Cria a tabela Comments se não existir
    const table = await queryInterface.describeTable('Comments').catch(() => null);
    if (!table) {
      await queryInterface.createTable('Comments', {
        id: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: Sequelize.INTEGER
        },
        content: {
          type: Sequelize.TEXT,
          allowNull: false
        },
        postId: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'Posts', key: 'id' },
          onDelete: 'CASCADE'
        },
        userId: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'Users', key: 'id' },
          onDelete: 'CASCADE'
        },
        createdAt: {
          allowNull: false,
          type: Sequelize.DATE,
          defaultValue: Sequelize.fn('NOW')
        },
        updatedAt: {
          allowNull: false,
          type: Sequelize.DATE,
          defaultValue: Sequelize.fn('NOW')
        }
      });
    } else {
      // Adiciona colunas se faltarem
      if (!table.postId) {
        await queryInterface.addColumn('Comments', 'postId', {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'Posts', key: 'id' },
          onDelete: 'CASCADE'
        });
      }
      if (!table.userId) {
        await queryInterface.addColumn('Comments', 'userId', {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'Users', key: 'id' },
          onDelete: 'CASCADE'
        });
      }
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Comments');
  }
};
