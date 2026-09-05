import { DataTypes, Model } from 'sequelize';
import sequelize from './db.js';

export class Follow extends Model { declare followerId: number; declare followingId: number; }
Follow.init({
  followerId: { type: DataTypes.INTEGER, allowNull: false },
  followingId: { type: DataTypes.INTEGER, allowNull: false }
}, { sequelize, modelName: 'Follow', tableName: 'Follows', timestamps: false, indexes: [{ unique: true, fields: ['followerId', 'followingId'] }] });