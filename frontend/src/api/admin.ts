import { api } from './client';
import { toUser, type UserResponse } from './types';
import { toSubmission, type SubmissionResponse } from './submissions';

export type CreateMemberInput = { name: string; studentId: string; initialPassword: string };
export type UpdateMemberInput = { name?: string; active?: boolean; newPassword?: string };
export type ReviewInput = { score: number; feedback?: string };

export const adminApi = {
  async members(signal?: AbortSignal) {
    return (await api<UserResponse[]>('/admin/users', { signal })).map(toUser);
  },
  async createMember(input: CreateMemberInput, signal?: AbortSignal) {
    return toUser(await api<UserResponse>('/admin/users', { method: 'POST', json: input, signal }));
  },
  async updateMember(id: string, input: UpdateMemberInput, signal?: AbortSignal) {
    return toUser(await api<UserResponse>(`/admin/users/${id}`, { method: 'PATCH', json: input, signal }));
  },
  async submissions(signal?: AbortSignal, filters: { assignmentId?: string; status?: 'PENDING' | 'REVIEWED' } = {}) {
    const params = new URLSearchParams(filters);
    return (await api<SubmissionResponse[]>(`/admin/submissions${params.size ? `?${params}` : ''}`, { signal })).map(toSubmission);
  },
  async review(id: string, input: ReviewInput, signal?: AbortSignal) {
    return toSubmission(await api<SubmissionResponse>(`/admin/submissions/${id}/review`, { method: 'PATCH', json: input, signal }));
  },
};
