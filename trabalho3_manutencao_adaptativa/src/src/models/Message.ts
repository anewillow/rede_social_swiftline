import { DataTypes, Model } from 'sequelize';
import sequelize from './db.js';

export class Message extends Model {
  declare id: number;
  declare senderId: number;
  declare receiverId: number;
  declare content: string;
  declare createdAt: Date;
}

Message.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  senderId: { type: DataTypes.INTEGER, allowNull: false },
  receiverId: { type: DataTypes.INTEGER, allowNull: false },
  content: { type: DataTypes.TEXT, allowNull: false }
}, { sequelize, modelName: 'Message', timestamps: true });