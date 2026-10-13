import { api } from './client';
import { withFiles } from './files';
import type { SelectedFile } from '@/data/lmsData';
import type { Submission, FileMetadata } from '@/data/lmsData';

export type SubmissionResponse = {
  id: string; assignmentId: string; userId: string; content: string | null;
  status: 'PENDING' | 'REVIEWED'; score: number | null; feedback: string | null;
  submittedAt: string; reviewedAt: string | null; reviewedBy: string | null; files: FileMetadata[];
};
export function toSubmission(value: SubmissionResponse): Submission & { reviewedAt: string | null } {
  return { id: value.id, assignmentId: value.assignmentId, userId: value.userId,
    text: value.content || '', status: value.status === 'REVIEWED' ? 'reviewed' : 'pending',
    score: value.score, feedback: value.feedback || '', submittedAt: value.submittedAt,
    reviewedAt: value.reviewedAt, files: value.files };
}
export const submissionsApi = {
  async mine(signal?: AbortSignal) {
    return (await api<SubmissionResponse[]>('/submissions/me', { signal })).map(toSubmission);
  },
  async submit(assignmentId: string, content: string, files: SelectedFile[], signal?: AbortSignal) {
    return toSubmission(await api<SubmissionResponse>(`/assignments/${assignmentId}/submission`, {
      method: 'POST', body: withFiles({ content: content || null }, files), signal,
    }));
  },
};
