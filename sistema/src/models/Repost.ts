import { DataTypes, Model } from 'sequelize';
import sequelize from './db.js';

export class Repost extends Model {
  declare id: number;
  declare userId: number;
  declare postId: number;
}

Repost.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  postId: { type: DataTypes.INTEGER, allowNull: false }
}, { sequelize, modelName: 'Repost', indexes: [{ unique: true, fields: ['userId', 'postId'] }] });
