"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn("Posts", "avatar", {
      type: Sequelize.TEXT,
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn("Posts", "avatar", {
      type: Sequelize.STRING,
      allowNull: true
    });
  }
};
