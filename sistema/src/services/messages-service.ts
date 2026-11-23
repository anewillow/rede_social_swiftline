import { serviceResult, type ServiceInput, type ServiceResult } from '../types/service.js';
import { Message, User } from '../models/index.js';
import { Op } from 'sequelize';
import { pageWindow } from '../http/pagination.js';

export async function searchPeople(req: ServiceInput): Promise<ServiceResult> {
  const query = String(req.query.q ?? '').trim();
  const page = pageWindow(req, 'message-people:' + query);
  const people = await User.findAll({
    where: page.where({
      id: { [Op.ne]: req.userId },
      ...(query ? { username: { [Op.like]: `%${query}%` } } : {}),
    }),
    attributes: ['id', 'username', 'avatar', 'bio', 'createdAt'],
    order: [['username', 'ASC']],
    limit: 30,
    ...page.options,
  });
  return serviceResult(page.wrap(page.take(people), people), 200);
}

export async function listMessages(req: ServiceInput): Promise<ServiceResult> {
  const otherId = Number(req.params.userId);
  const page = pageWindow(req, 'messages:' + otherId);
  const messages = await Message.findAll({
    where: page.where({
      [Op.or]: [
        { senderId: req.userId, receiverId: otherId },
        { senderId: otherId, receiverId: req.userId },
      ],
    }),
    order: [['createdAt', 'ASC']],
    include: [{ model: User, as: 'sender', attributes: ['username', 'avatar'] }],
    ...page.options,
  });
  return serviceResult(page.wrap(page.take(messages), messages), 200);
}

export async function sendMessage(req: ServiceInput): Promise<ServiceResult> {
  const content = String(req.body.content ?? '').trim();
  const receiverId = Number(req.params.userId);
  if (!content) return serviceResult({ error: 'Mensagem obrigatória' }, 400);
  if (receiverId === req.userId || !(await User.findByPk(receiverId)))
    return serviceResult({ error: 'Destinatário inválido' }, 400);
  const message = await Message.create({ senderId: req.userId!, receiverId, content });
  await message.reload({
    include: [{ model: User, as: 'sender', attributes: ['username', 'avatar'] }],
  });
  return serviceResult(message, 201);
}
