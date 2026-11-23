import { serviceResult, type ServiceInput, type ServiceResult } from '../types/service.js';
import { PollOption, PollVote, Post } from '../models/index.js';
import sequelize from '../config/database.js';
import { postsWithActivity } from './post-activity-service.js';
import { UniqueConstraintError } from 'sequelize';
import { LIMITS, codePoints } from '../../shared/contracts/index.js';

export async function vote(req: ServiceInput): Promise<ServiceResult> {
  const postId = Number(req.params.id);
  const optionId = Number(req.body.optionId);
  if (!Number.isInteger(postId) || !Number.isInteger(optionId))
    return serviceResult({ message: 'Escolha uma opção válida.' }, 400);
  try { return await sequelize.transaction(async (transaction) => {
  const post = await Post.findByPk(postId, { transaction, lock: transaction.LOCK.UPDATE });
  const option = await PollOption.findOne({ where: { id: optionId, postId }, transaction });
  if (!post || !option)
    return serviceResult({ message: 'Esta enquete não está disponível.' }, 404);
  const existingVote = await PollVote.findOne({ where: { postId, userId: req.userId }, transaction });
  if (existingVote && (req.apiVersion !== 2 || existingVote.optionId !== optionId))
    return serviceResult({ message: 'Você já votou nesta enquete.' }, 409);
  if (!existingVote) await PollVote.create({ postId, optionId, userId: req.userId! }, { transaction });
  const updatedPost = (await postsWithActivity([post], req.userId, transaction))[0];
  return serviceResult({ poll: updatedPost.poll }, 200);
  }); } catch (error) {
    if (error instanceof UniqueConstraintError) return serviceResult({ message: 'Você já votou nesta enquete.' }, 409);
    throw error;
  }
}

export async function updatePoll(req: ServiceInput): Promise<ServiceResult> {
  const postId = Number(req.params.id);
  const question = String(req.body.question ?? '').trim();
  const requestedOptions = Array.isArray(req.body.options)
    ? (req.body.options as Array<{ id?: unknown; text?: unknown }>).map((option) => ({
        id: Number(option.id),
        text: String(option.text ?? '').trim(),
      }))
    : [];
  if (!Number.isInteger(postId))
    return serviceResult({ message: 'Enquete inválida.' }, 400);
  if (!question || codePoints(question) > LIMITS.post)
    return serviceResult({ message: 'A pergunta deve ter de 1 a 280 caracteres.' }, 400);
  if (requestedOptions.length < 2 || requestedOptions.length > 4)
    return serviceResult({ message: 'A enquete deve ter de 2 a 4 opções.' }, 400);
  if (
    requestedOptions.some(
      (option) => !Number.isInteger(option.id) || !option.text || codePoints(option.text) > LIMITS.pollOption,
    )
  )
    return serviceResult({ message: 'Revise as opções da enquete.' }, 400);
  if (
    new Set(requestedOptions.map((option) => option.text.toLocaleLowerCase('pt-BR'))).size !==
    requestedOptions.length
  )
    return serviceResult({ message: 'As opções precisam ser diferentes.' }, 400);

  const [post, currentOptions] = await Promise.all([
    Post.findByPk(postId),
    PollOption.findAll({ where: { postId }, order: [['position', 'ASC']] }),
  ]);
  if (!post || !currentOptions.length)
    return serviceResult({ message: 'Enquete não encontrada.' }, 404);
  if (post.userId !== req.userId)
    return serviceResult({ message: 'Apenas o autor pode editar esta enquete.' }, 403);
  const currentIds = currentOptions.map((option) => option.id).sort((a, b) => a - b);
  const requestedIds = requestedOptions.map((option) => option.id).sort((a, b) => a - b);
  if (
    currentIds.length !== requestedIds.length ||
    currentIds.some((id, index) => id !== requestedIds[index])
  )
    return serviceResult({ message: 'As opções existentes devem ser mantidas.' }, 400);

  return sequelize.transaction(async (transaction) => {
    await post.reload({ transaction, lock: transaction.LOCK.UPDATE });
    if (!await PollOption.count({ where: { postId }, transaction })) return serviceResult({ message: 'Enquete não encontrada.' }, 404);
    await post.update({ content: question }, { transaction });
    await Promise.all(
      requestedOptions.map((requestedOption) =>
        PollOption.update(
          { text: requestedOption.text },
          { where: { id: requestedOption.id, postId }, transaction },
        ),
      ),
    );
    const updatedPost = (await postsWithActivity([post], req.userId, transaction))[0];
    return serviceResult({ post: updatedPost }, 200);
  });
}

export async function deletePoll(req: ServiceInput): Promise<ServiceResult> {
  const postId = Number(req.params.id);
  const post = Number.isInteger(postId) ? await Post.findByPk(postId) : null;
  if (!post) return serviceResult({ message: 'Enquete não encontrada.' }, 404);
  if (post.userId !== req.userId)
    return serviceResult({ message: 'Apenas o autor pode excluir esta enquete.' }, 403);
  const optionCount = await PollOption.count({ where: { postId } });
  if (!optionCount) return serviceResult({ message: 'Enquete não encontrada.' }, 404);
  await sequelize.transaction(async (transaction) => {
    await post.reload({ transaction, lock: transaction.LOCK.UPDATE });
    await PollVote.destroy({ where: { postId }, transaction });
    await PollOption.destroy({ where: { postId }, transaction });
  });
  return serviceResult({ message: 'Enquete excluída.' }, 200);
}
