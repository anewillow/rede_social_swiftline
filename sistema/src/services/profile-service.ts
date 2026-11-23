import { serviceResult, type ServiceInput, type ServiceResult } from '../types/service.js';
import { User } from '../models/index.js';
import sequelize from '../config/database.js';
import { privateUser } from './user-presentation.js';
import { prepareAvatar, prepareCover } from './profile-images-service.js';
import { discardImage, mayKeepImageUrl, promoteImage, releaseImage, type ManagedImage } from '../infrastructure/storage/managed-images.js';
import { enqueueImageCleanup, tryImageCleanup } from '../infrastructure/storage/file-cleanup.js';

export async function updateProfile(req: ServiceInput): Promise<ServiceResult> {
  const user = await User.findByPk(req.userId);
  if (!user) return serviceResult({ message: 'Usuário não encontrado.' }, 404);
  const { username, bio, avatar, cover, location, website } = req.body as Record<string, string>;
  if (username !== undefined && !username.trim())
    return serviceResult({ message: 'Nome de usuário obrigatório.' }, 400);

  const preparedAvatar =
    typeof avatar === 'string' && avatar ? prepareAvatar(avatar, user.id) : null;
  const preparedCover = typeof cover === 'string' && cover ? prepareCover(cover, user.id) : null;

  if (typeof avatar === 'string' && avatar && !preparedAvatar) {
    return serviceResult({ message: 'Avatar inválido ou maior que 3 MB.' }, 400);
  }
  if (typeof cover === 'string' && cover && !preparedCover) {
    return serviceResult({ message: 'Imagem de capa inválida ou maior que 3 MB.' }, 400);
  }
  if ((typeof avatar === 'string' && !mayKeepImageUrl(avatar, user.avatar)) || (typeof cover === 'string' && !mayKeepImageUrl(cover, user.cover)))
    return serviceResult({ message: 'Envie uma nova imagem ou mantenha a imagem atual.' }, 400);

  let savedAvatar: ManagedImage | undefined;
  let savedCover: ManagedImage | undefined;
  try {
    if (preparedAvatar?.bytes) savedAvatar = await promoteImage(preparedAvatar.bytes);
    if (preparedCover?.bytes) savedCover = await promoteImage(preparedCover.bytes);

    const result = await sequelize.transaction(async (transaction) => {
      const current = await User.findByPk(req.userId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!current) throw new Error('Conta indisponível');
      if ((typeof avatar === 'string' && !mayKeepImageUrl(avatar, current.avatar)) || (typeof cover === 'string' && !mayKeepImageUrl(cover, current.cover))) throw new Error('Imagem alterada em outro pedido');
      const nextAvatar = typeof avatar === 'string' ? savedAvatar?.url ?? preparedAvatar?.url ?? '' : current.avatar;
      const nextCover = typeof cover === 'string' ? savedCover?.url ?? preparedCover?.url ?? '' : current.cover;
      if (nextAvatar !== current.avatar) await enqueueImageCleanup(current.avatar, transaction, { id: current.id, kind: 'avatar' });
      if (nextCover !== current.cover) await enqueueImageCleanup(current.cover, transaction, { id: current.id, kind: 'cover' });
      if (username) current.username = username.trim();
      if (typeof bio === 'string') current.bio = bio;
      if (typeof location === 'string') current.location = location;
      if (typeof website === 'string') current.website = website;
      current.avatar = nextAvatar;
      current.cover = nextCover;
      await current.save({ transaction });
      return privateUser(current);
    });
    releaseImage(savedAvatar); releaseImage(savedCover);
    await tryImageCleanup();
    return serviceResult({ message: 'Perfil atualizado!', user: result }, 200);
  } catch {
    await Promise.allSettled([discardImage(savedAvatar), discardImage(savedCover)]);
    return serviceResult({ message: 'Não foi possível atualizar o perfil.' }, 500);
  }
}
