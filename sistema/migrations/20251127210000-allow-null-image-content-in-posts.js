'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('Posts', 'image', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.changeColumn('Posts', 'content', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('Posts', 'image', {
      type: Sequelize.STRING,
      allowNull: false,
    });
    await queryInterface.changeColumn('Posts', 'content', {
      type: Sequelize.STRING,
      allowNull: false,
    });
  }
};
