import { api, ApiError, refreshCsrf } from './client';
import { toUser, type UserResponse } from './types';

export type LoginCredentials = { studentId: string; password: string };

export const authApi = {
  async restore(signal?: AbortSignal) {
    try { return toUser(await api<UserResponse>('/auth/me', { signal, silentUnauthorized: true })); }
    catch (error) { if (error instanceof ApiError && error.status === 401) return null; throw error; }
  },
  async login(credentials: LoginCredentials, signal?: AbortSignal) {
    await refreshCsrf(signal);
    await api<UserResponse>('/auth/login', { method: 'POST', json: credentials, signal, silentUnauthorized: true });
    await refreshCsrf(signal);
    return toUser(await api<UserResponse>('/auth/me', { signal }));
  },
  async logout() {
    await api<void>('/auth/logout', { method: 'POST' });
    // The session has already ended; a failed token refresh must not restore the UI session.
    await refreshCsrf().catch(() => undefined);
  },
};
