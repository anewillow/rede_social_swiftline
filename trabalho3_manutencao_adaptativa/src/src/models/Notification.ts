import { DataTypes, Model } from 'sequelize';
import sequelize from './db.js';

export class Notification extends Model {
  declare id: number;
  declare userId: number;
  declare actorId: number;
  declare type: 'follow' | 'like' | 'comment';
  declare message: string;
  declare isRead: boolean;
  declare createdAt: Date;
}

Notification.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  actorId: { type: DataTypes.INTEGER, allowNull: false },
  type: { type: DataTypes.ENUM('follow', 'like', 'comment'), allowNull: false },
  message: { type: DataTypes.STRING, allowNull: false },
  isRead: { type: DataTypes.BOOLEAN, defaultValue: false }
}, { sequelize, modelName: 'Notification', timestamps: true });