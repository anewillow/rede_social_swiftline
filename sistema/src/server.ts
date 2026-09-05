import 'dotenv/config';
import app from './app.js';
import sequelize from './models/db.js';
import { Post, User } from './models/index.js';

const port = Number(process.env.PORT ?? 3000);

async function startServer(): Promise<void> {
  try {
    await sequelize.authenticate();
    console.log('MySQL conectado');
    await sequelize.sync();
    const posts = await Post.findAll({ attributes: ['id', 'userId', 'author'] });
    const users = await User.findAll({ attributes: ['id', 'username', 'avatar'] });
    const usersById = new Map(users.map((user) => [user.id, user]));
    await Promise.all(posts.map(async (post) => {
      const owner = usersById.get(post.userId);
      if (owner && (post.author !== owner.username || post.avatar !== owner.avatar)) {
        await post.update({ author: owner.username, avatar: owner.avatar });
      }
    }));
    app.listen(port, () => console.log(`Swiftline está online em http://localhost:${port}`));
  } catch (error) {
    console.error('Erro ao conectar ao MySQL:', error);
    process.exitCode = 1;
  }
}

void startServer();