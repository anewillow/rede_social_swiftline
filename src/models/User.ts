import { DataTypes, Model } from 'sequelize';
import sequelize from './db.js';

export class User extends Model {
  declare id: number;
  declare username: string;
  declare email: string;
  declare password: string;
  declare bio: string | null;
  declare avatar: string | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

User.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  username: { type: DataTypes.STRING, allowNull: false, unique: true },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  password: { type: DataTypes.STRING, allowNull: false },
  bio: { type: DataTypes.TEXT, allowNull: true, defaultValue: 'Escreva aqui sua bio.' },
  avatar: { type: DataTypes.TEXT, allowNull: true }
}, { sequelize, modelName: 'User', timestamps: true });