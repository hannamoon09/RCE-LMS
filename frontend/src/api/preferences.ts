import { api } from './client';
import type { Preferences } from '@/data/lmsData';

export const preferencesApi = {
  get: (signal?: AbortSignal) => api<Preferences>('/me/preferences', { signal }),
  save: (preferences: Preferences, signal?: AbortSignal) => api<Preferences>('/me/preferences', { method: 'PATCH', json: preferences, signal }),
};
