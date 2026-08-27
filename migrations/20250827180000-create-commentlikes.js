"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("CommentLikes", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Users", key: "id" },
        onDelete: "CASCADE"
      },
      commentId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Comments", key: "id" },
        onDelete: "CASCADE"
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
    await queryInterface.addConstraint('CommentLikes', {
      fields: ['userId', 'commentId'],
      type: 'unique',
      name: 'unique_user_comment_like'
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("CommentLikes");
  }
};
