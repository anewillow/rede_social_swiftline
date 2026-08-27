import { DataTypes, Model } from 'sequelize';
import sequelize from './db.js';

export class CommentLike extends Model { declare id: number; declare userId: number; declare commentId: number; }
CommentLike.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  commentId: { type: DataTypes.INTEGER, allowNull: false }
}, { sequelize, modelName: 'CommentLike', indexes: [{ unique: true, fields: ['userId', 'commentId'] }] });