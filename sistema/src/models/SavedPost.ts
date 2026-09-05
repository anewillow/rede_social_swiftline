import { DataTypes, Model } from 'sequelize';
import sequelize from './db.js';

export class SavedPost extends Model {
  declare id: number;
  declare userId: number;
  declare postId: number;
}

SavedPost.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  postId: { type: DataTypes.INTEGER, allowNull: false }
}, { sequelize, modelName: 'SavedPost', indexes: [{ unique: true, fields: ['userId', 'postId'] }] });
