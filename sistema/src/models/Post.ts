import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

export class Post extends Model {
  declare id: number;
  declare userId: number;
  declare image: string | null;
  declare content: string | null;
  declare likes: number;
  declare shares: number;
  declare isStory: boolean;
  declare createdAt: Date;
}

Post.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  image: { type: DataTypes.STRING, allowNull: true },
  content: { type: DataTypes.TEXT, allowNull: true },
  likes: { type: DataTypes.INTEGER, defaultValue: 0 },
  shares: { type: DataTypes.INTEGER, defaultValue: 0 },
  isStory: { type: DataTypes.BOOLEAN, defaultValue: false }
}, { sequelize, modelName: 'Post', tableName: 'posts', timestamps: true });
