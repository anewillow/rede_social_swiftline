import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

export class PollVote extends Model {
  declare id: number;
  declare postId: number;
  declare optionId: number;
  declare userId: number;
}

PollVote.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    postId: { type: DataTypes.INTEGER, allowNull: false },
    optionId: { type: DataTypes.INTEGER, allowNull: false },
    userId: { type: DataTypes.INTEGER, allowNull: false },
  },
  {
    sequelize,
    modelName: 'PollVote',
    tableName: 'poll_votes',
    timestamps: true,
    indexes: [{ unique: true, fields: ['postId', 'userId'] }],
  },
);
