'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('poll_options', {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      postId: {
        allowNull: false,
        type: Sequelize.INTEGER,
        references: { model: 'posts', key: 'id' },
        onDelete: 'CASCADE',
      },
      text: { allowNull: false, type: Sequelize.STRING(80) },
      position: { allowNull: false, type: Sequelize.INTEGER },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });

    await queryInterface.createTable('poll_votes', {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      postId: {
        allowNull: false,
        type: Sequelize.INTEGER,
        references: { model: 'posts', key: 'id' },
        onDelete: 'CASCADE',
      },
      optionId: {
        allowNull: false,
        type: Sequelize.INTEGER,
        references: { model: 'poll_options', key: 'id' },
        onDelete: 'CASCADE',
      },
      userId: {
        allowNull: false,
        type: Sequelize.INTEGER,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE',
      },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });

    await queryInterface.addIndex('poll_votes', ['postId', 'userId'], {
      unique: true,
      name: 'poll_votes_post_user_unique',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('poll_votes');
    await queryInterface.dropTable('poll_options');
  },
};
