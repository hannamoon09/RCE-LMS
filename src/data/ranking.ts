import type { LMSState, Submission, Track } from './lmsData';

export type LeaderboardEntry = {
  userId: string;
  name: string;
  track: Track;
  totalScore: number;
  averageScore: number | null;
  reviewedCount: number;
  rank: number | null;
};

const names = new Intl.Collator('ko', { numeric: true });
const compareId = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;

/**
 * Rankings are derived from submissions, including staff and inactive accounts.
 * The latest timestamp wins per learner/assignment, even when still pending.
 * Equal timestamps use the lexically greater submission ID, independent of array order.
 * Invalid dates/scores and references to deleted assignments/users are ignored.
 * Unreviewed learners have no rank; an explicitly reviewed zero is a valid score.
 */
export function calculateLeaderboard(state: LMSState, track: Track): LeaderboardEntry[] {
  const users = state.users.filter(user => user.track === track);
  const userIds = new Set(users.map(user => user.id));
  const assignmentIds = new Set(state.assignments.map(assignment => assignment.id));
  const latest = new Map<string, Map<string, Submission>>();

  for (const submission of state.submissions) {
    if (!userIds.has(submission.userId) || !assignmentIds.has(submission.assignmentId)) continue;
    const submittedAt = Date.parse(submission.submittedAt);
    if (!Number.isFinite(submittedAt)) continue;
    const assignments = latest.get(submission.userId) ?? new Map<string, Submission>();
    const previous = assignments.get(submission.assignmentId);
    const previousAt = previous ? Date.parse(previous.submittedAt) : -Infinity;
    if (!previous || submittedAt > previousAt || submittedAt === previousAt && compareId(submission.id, previous.id) > 0) {
      assignments.set(submission.assignmentId, submission);
    }
    latest.set(submission.userId, assignments);
  }

  const entries = users.map(user => {
    let totalScore = 0;
    let reviewedCount = 0;
    for (const submission of latest.get(user.id)?.values() ?? []) {
      if (submission.status !== 'reviewed' || submission.score === null || !Number.isFinite(submission.score) || submission.score < 0 || submission.score > 100) continue;
      totalScore += submission.score;
      reviewedCount += 1;
    }
    return {
      entry: {
        userId: user.id, name: user.name, track: user.track, totalScore, reviewedCount,
        averageScore: reviewedCount ? totalScore / reviewedCount : null,
        rank: null,
      } as LeaderboardEntry,
      studentId: user.studentId,
    };
  });

  entries.sort((left, right) => {
    const a = left.entry;
    const b = right.entry;
    return Number(b.reviewedCount > 0) - Number(a.reviewedCount > 0)
      || b.totalScore - a.totalScore
      || (b.averageScore ?? 0) - (a.averageScore ?? 0)
      || b.reviewedCount - a.reviewedCount
      || names.compare(a.name, b.name)
      || compareId(left.studentId, right.studentId)
      || compareId(a.userId, b.userId);
  });
  return entries.map(({ entry }, index) => ({ ...entry, rank: entry.reviewedCount ? index + 1 : null }));
}

export function calculateStudentRanking(state: LMSState, userId: string): (LeaderboardEntry & { rankedCount: number; totalCount: number }) | null {
  const user = state.users.find(candidate => candidate.id === userId);
  if (!user) return null;
  const leaderboard = calculateLeaderboard(state, user.track);
  const entry = leaderboard.find(candidate => candidate.userId === userId)!;
  return { ...entry, rankedCount: leaderboard.filter(candidate => candidate.rank !== null).length, totalCount: leaderboard.length };
}
