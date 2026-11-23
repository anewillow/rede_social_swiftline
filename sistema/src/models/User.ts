import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

export class User extends Model {
  declare id: number;
  declare username: string;
  declare email: string;
  declare password: string;
  declare bio: string | null;
  declare avatar: string | null;
  declare cover: string | null;
  declare location: string | null;
  declare website: string | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

User.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  username: { type: DataTypes.STRING, allowNull: false, unique: true },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  password: { type: DataTypes.STRING, allowNull: false },
  bio: { type: DataTypes.TEXT, allowNull: true, defaultValue: 'Escreva aqui sua bio.' },
  avatar: { type: DataTypes.STRING, allowNull: true, defaultValue: '' },
  cover: { type: DataTypes.STRING, allowNull: true, defaultValue: '' },
  location: { type: DataTypes.STRING(120), allowNull: true, defaultValue: '' },
  website: { type: DataTypes.STRING(2048), allowNull: true, defaultValue: '' }
}, { sequelize, modelName: 'User', timestamps: true });
