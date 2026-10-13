import { api } from './client';

/** Rankings deliberately contain no student identifiers or account details. */
export type RankingEntry = {
  rank: number;
  name: string;
  totalScore: number;
  averageScore: number;
  reviewedCount: number;
  isMe: boolean;
};

export const rankingsApi = {
  mine: (signal?: AbortSignal) => api<RankingEntry[]>('/rankings/me', { signal }),
  admin: (signal?: AbortSignal) => api<RankingEntry[]>('/admin/rankings', { signal }),
};
