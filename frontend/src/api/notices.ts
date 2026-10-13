import { api } from './client';
import { trackLabels, type ApiTrack } from './types';
import type { Notice } from '@/data/lmsData';

export type NoticeInput = { title: string; body: string; category: string; important: boolean };
export type NoticeResponse = NoticeInput & { id: string; track: ApiTrack | null; author: string; createdAt: string; updatedAt: string };
export function toNotice(notice: NoticeResponse): Notice {
  return { id: notice.id, title: notice.title, body: notice.body.split(/\r?\n\s*\r?\n/), category: notice.category,
    important: notice.important, track: notice.track === null ? 'all' : trackLabels[notice.track], author: notice.author, date: notice.createdAt };
}
export function compareNotices(a: Notice, b: Notice): number {
  return Number(b.important) - Number(a.important) || Date.parse(b.date) - Date.parse(a.date) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}
export const noticesApi = {
  async list(signal?: AbortSignal) { return (await api<NoticeResponse[]>('/notices', { signal })).map(toNotice); },
  async get(id: string, signal?: AbortSignal) { return toNotice(await api<NoticeResponse>(`/notices/${id}`, { signal })); },
  async create(input: NoticeInput, signal?: AbortSignal) { return toNotice(await api<NoticeResponse>('/admin/notices', { method: 'POST', json: input, signal })); },
  async update(id: string, input: NoticeInput, signal?: AbortSignal) { return toNotice(await api<NoticeResponse>(`/admin/notices/${id}`, { method: 'PATCH', json: input, signal })); },
  remove: (id: string, signal?: AbortSignal) => api<void>(`/admin/notices/${id}`, { method: 'DELETE', signal }),
};
