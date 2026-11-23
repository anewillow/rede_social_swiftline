'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const columns = await queryInterface.describeTable('Users');
    if (!columns.cover) {
      await queryInterface.addColumn('Users', 'cover', {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: ''
      });
    }
  },

  down: async (queryInterface) => {
    const columns = await queryInterface.describeTable('Users');
    if (columns.cover) await queryInterface.removeColumn('Users', 'cover');
  }
};
