'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Posts', 'userId', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1 // Ajuste para um userId válido existente, se necessário
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Posts', 'userId');
  }
};
