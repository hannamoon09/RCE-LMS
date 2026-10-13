import { api } from './client';
import { withFiles } from './files';
import type { SelectedFile } from '@/data/lmsData';
import type { LMSAssignment } from '@/data/lmsData';

export type AssignmentInput = Pick<LMSAssignment, 'title' | 'description' | 'difficulty' | 'deadline'>;
export const assignmentsApi = {
  list: (signal?: AbortSignal) => api<LMSAssignment[]>('/assignments', { signal }),
  get: (id: string, signal?: AbortSignal) => api<LMSAssignment>(`/assignments/${id}`, { signal }),
  create: (assignment: AssignmentInput, files: SelectedFile[], signal?: AbortSignal) => api<LMSAssignment>('/admin/assignments', { method: 'POST', body: withFiles(assignment, files), signal }),
  update: (id: string, assignment: AssignmentInput, files: SelectedFile[], signal?: AbortSignal) => api<LMSAssignment>(`/admin/assignments/${id}`, { method: 'PATCH', body: withFiles(assignment, files), signal }),
  remove: (id: string, signal?: AbortSignal) => api<void>(`/admin/assignments/${id}`, { method: 'DELETE', signal }),
};
