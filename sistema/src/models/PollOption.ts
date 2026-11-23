import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

export class PollOption extends Model {
  declare id: number;
  declare postId: number;
  declare text: string;
  declare position: number;
}

PollOption.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    postId: { type: DataTypes.INTEGER, allowNull: false },
    text: { type: DataTypes.STRING(80), allowNull: false },
    position: { type: DataTypes.INTEGER, allowNull: false },
  },
  { sequelize, modelName: 'PollOption', tableName: 'poll_options', timestamps: true },
);
