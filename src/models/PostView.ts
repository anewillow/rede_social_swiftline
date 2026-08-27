import { DataTypes, Model } from 'sequelize';
import sequelize from './db.js';

export class PostView extends Model {
  declare id: number;
  declare userId: number;
  declare postId: number;
}

PostView.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  postId: { type: DataTypes.INTEGER, allowNull: false }
}, { sequelize, modelName: 'PostView', indexes: [{ unique: true, fields: ['userId', 'postId'] }] });
