import type { AuthInput, RegistrationInput, ProfileInput } from '../../shared/contracts/index';
import { request, jsonRequest } from './api';
import { decodeUser, decodeShape, decodeString } from '../../shared/contracts/index';

export const authApi = {
  getCurrentUser: (signal?: AbortSignal) => request('/api/v2/auth/me', decodeUser, { signal }),
  login: (data: AuthInput) => jsonRequest('/api/v2/auth/login', 'POST', data, decodeShape({ token: decodeString, user: decodeUser }), false),
  register: (data: RegistrationInput) => jsonRequest('/api/v2/auth/register', 'POST', data, decodeUser, false),
  updateProfile: (data: ProfileInput) => jsonRequest('/api/v2/auth/profile', 'PUT', data, decodeShape({ user: decodeUser, message: decodeString })),
  deleteAccount: (data: { password: string }) => jsonRequest('/api/v2/auth/delete', 'DELETE', data, decodeShape({ message: decodeString })),
};
