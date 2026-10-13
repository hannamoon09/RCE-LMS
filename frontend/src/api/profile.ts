import { api } from './client';
import { toUser, type UserResponse } from './types';

export const profileApi = {
  async get(signal?: AbortSignal) {
    return toUser(await api<UserResponse>('/me', { signal }));
  },
  async update(name: string, email: string, signal?: AbortSignal) {
    return toUser(await api<UserResponse>('/me', { method: 'PATCH', json: { name: name.trim(), email: email.trim() || null }, signal }));
  },
  async image(file: File | null, signal?: AbortSignal) {
    const body = file ? new FormData() : undefined;
    if (file) body!.append('file', file, file.name);
    return toUser(await api<UserResponse>('/me/profile-image', { method: file ? 'POST' : 'DELETE', body, signal }));
  },
  password(currentPassword: string, newPassword: string, signal?: AbortSignal) {
    return api<void>('/me/password', { method: 'PATCH', json: { currentPassword, newPassword }, signal });
  },
};
