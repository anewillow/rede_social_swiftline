import { serviceResult, type ServiceInput, type ServiceResult } from '../types/service.js';
import { User } from '../models/index.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import { secret } from '../middleware/auth.js';
import { privateUser } from './user-presentation.js';

export async function register(req: ServiceInput): Promise<ServiceResult> {
  const { username, email, password } = req.body as Record<string, string>;
  const acceptedTerms = (req.body as { acceptedTerms?: boolean | string }).acceptedTerms;
  if (!username?.trim()) return serviceResult({ message: 'Nome é obrigatório.' }, 400);
  if (acceptedTerms !== true && acceptedTerms !== 'true')
    return serviceResult({
      message: 'Você precisa aceitar os Termos de Uso e a Política de Privacidade.',
    }, 400);
  if (!email?.match(/^[\w.-]+@[\w-]+\.[a-zA-Z]{2,}$/))
    return serviceResult({ message: 'Email inválido. Informe um email válido.' }, 400);
  if (!password || password.length < 6 || !/[!@#$%^&*(),.?":{}|<>]/.test(password))
    return serviceResult({ message: 'Senha fraca. Mínimo 6 caracteres e pelo menos um caractere especial.' }, 400);
  const exists = await User.findOne({
    where: { [Op.or]: [{ email }, { username: username.trim() }] },
  });
  if (exists)
    return serviceResult({
      message: exists.email === email ? 'Email já cadastrado.' : 'Nome de usuário já cadastrado.',
    }, 400);
  const user = await User.create({
    username: username.trim(),
    email,
    password: await bcrypt.hash(password, 10),
  });
  return serviceResult(privateUser(user), 201);
}

export async function login(req: ServiceInput): Promise<ServiceResult> {
  const { email, password } = req.body as Record<string, string>;
  const user = await User.findOne({ where: { email } });
  if (!user) return { ...serviceResult({ message: 'Usuário não encontrado.' }, 400), code: 'INVALID_CREDENTIALS' };
  if (!(await bcrypt.compare(password ?? '', user.password)))
    return { ...serviceResult({ message: 'Senha inválida.' }, 400), code: 'INVALID_CREDENTIALS' };
  return serviceResult({
    token: jwt.sign({ id: user.id }, secret(), { expiresIn: '1d' }),
    user: privateUser(user),
  }, 200);
}

export async function getCurrentUser(req: ServiceInput): Promise<ServiceResult> {
  const user = await User.findByPk(req.userId);
  if (!user) return { ...serviceResult({ message: 'Usuário não encontrado' }, 404), code: 'SESSION_INVALID' };
  return serviceResult(privateUser(user), 200);
}
