'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Users', 'cover', {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: ''
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('Users', 'cover');
  }
};