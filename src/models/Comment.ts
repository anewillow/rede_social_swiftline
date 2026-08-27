import { DataTypes, Model } from 'sequelize';
import sequelize from './db.js';

export class Comment extends Model { declare id: number; declare content: string; declare userId: number; declare postId: number; declare createdAt: Date; }
Comment.init({
  content: { type: DataTypes.TEXT, allowNull: false },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  postId: { type: DataTypes.INTEGER, allowNull: false }
}, { sequelize, modelName: 'Comment', timestamps: true });