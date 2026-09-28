import { expect, test } from '@playwright/test';
import { initialState, type LMSState, type LMSUser, type Submission } from '../src/data/lmsData';
import { calculateLeaderboard, calculateStudentRanking } from '../src/data/ranking';

const fixture = (): LMSState => ({ ...structuredClone(initialState), submissions: [] });
const student = (id: string, overrides: Partial<LMSUser> = {}): LMSUser => ({
  ...initialState.users[2], id, name: id, studentId: id, ...overrides,
});
const submission = (id: string, userId: string, assignmentId: string, score: number | null, overrides: Partial<Submission> = {}): Submission => ({
  id, userId, assignmentId, score, submittedAt: '2026-09-01T00:00:00.000Z',
  status: 'reviewed', feedback: '', files: [], ...overrides,
});

test('rankings use the learner track, include all account roles, and distinguish the ranked population', () => {
  expect(calculateLeaderboard(initialState, '웹해킹')).toEqual([
    { userId: 'hanna', name: 'Hanna', track: '웹해킹', totalScore: 94, averageScore: 94, reviewedCount: 1, rank: 1 },
    { userId: 'minseo', name: '박민서', track: '웹해킹', totalScore: 88, averageScore: 88, reviewedCount: 1, rank: 2 },
  ]);
  expect(calculateLeaderboard(initialState, '포너블')).toEqual([
    { userId: 'jihoon', name: '김지훈', track: '포너블', totalScore: 0, averageScore: null, reviewedCount: 0, rank: null },
  ]);
  expect(calculateLeaderboard(initialState, '리버싱')[0]).toMatchObject({ userId: 'yujin', rank: null });
  expect(calculateStudentRanking(initialState, 'hanna')).toMatchObject({ rank: 1, totalScore: 94, rankedCount: 2, totalCount: 2 });
  expect(calculateStudentRanking(initialState, 'yujin')).toMatchObject({ rank: null, rankedCount: 0, totalCount: 1 });
  expect(calculateStudentRanking(initialState, 'unknown')).toBeNull();
  const state = fixture();
  state.users = [];
  expect(calculateLeaderboard(state, '웹해킹')).toEqual([]);
});

test('only the latest submission per assignment counts and a new pending submission supersedes a reviewed score', () => {
  const state = fixture();
  state.submissions = [
    submission('older', 'hanna', 'web-03', 95, { submittedAt: '2026-09-01T09:00:00+09:00' }),
    submission('newer', 'hanna', 'web-03', null, { submittedAt: '2026-09-01T01:00:00Z', status: 'pending' }),
    submission('reviewed-old', 'hanna', 'sys-02', 40),
    submission('reviewed-new', 'hanna', 'sys-02', 80, { submittedAt: '2026-09-02T00:00:00Z' }),
    submission('other-user', 'minseo', 'sys-02', 20),
  ];
  expect(calculateStudentRanking(state, 'hanna')).toMatchObject({ totalScore: 80, averageScore: 80, reviewedCount: 1, rank: 1 });
  expect(calculateStudentRanking(state, 'minseo')).toMatchObject({ totalScore: 20, reviewedCount: 1 });
  const expected = calculateLeaderboard(state, '웹해킹');
  state.submissions.reverse();
  expect(calculateLeaderboard(state, '웹해킹')).toEqual(expected);
});

test('equal submission timestamps choose a deterministic ID and do not prefer an old reviewed result', () => {
  const state = fixture();
  state.submissions = [
    submission('submission-a', 'hanna', 'web-03', 100),
    submission('submission-z', 'hanna', 'web-03', null, { status: 'pending' }),
    submission('review-a', 'minseo', 'web-03', 10),
    submission('review-z', 'minseo', 'web-03', 30),
  ];
  expect(calculateStudentRanking(state, 'hanna')).toMatchObject({ rank: null, averageScore: null, reviewedCount: 0 });
  expect(calculateStudentRanking(state, 'minseo')).toMatchObject({ rank: 1, totalScore: 30, reviewedCount: 1 });
  const expected = calculateLeaderboard(state, '웹해킹');
  state.submissions.reverse();
  expect(calculateLeaderboard(state, '웹해킹')).toEqual(expected);
});

test('a reviewed zero is ranked while pending, null, and invalid scores are ungraded', () => {
  const state = fixture();
  state.submissions = [
    submission('zero', 'hanna', 'web-03', 0),
    submission('pending-score', 'minseo', 'web-03', 90, { status: 'pending' }),
    submission('null', 'minseo', 'sys-02', null),
    submission('nan', 'minseo', 'net-01', Number.NaN),
    submission('negative', 'minseo', 'web-02', -1),
    submission('overflow', 'minseo', 'sys-03', 101),
    submission('infinity', 'minseo', 'net-02', Infinity),
  ];
  expect(calculateStudentRanking(state, 'hanna')).toMatchObject({ totalScore: 0, averageScore: 0, reviewedCount: 1, rank: 1, rankedCount: 1, totalCount: 2 });
  expect(calculateStudentRanking(state, 'minseo')).toMatchObject({ totalScore: 0, averageScore: null, reviewedCount: 0, rank: null });
});

test('ties use total, precise average, reviewed count, name, student ID, then user ID', () => {
  const state = fixture();
  state.users = [
    student('total'), student('average'), student('lower-average'),
    student('zero-more', { name: '하' }), student('zero-name-first', { name: '가' }),
    student('zero-name-last', { name: '나', studentId: '002' }),
    student('zero-student-first', { name: '나', studentId: '001' }),
    student('zero-id-first', { name: '나', studentId: '002' }),
    student('ungraded', { name: 'A' }),
  ];
  const scores: Record<string, number[]> = {
    total: [90, 90], average: [100], 'lower-average': [50, 50],
    'zero-more': [0, 0], 'zero-name-first': [0], 'zero-name-last': [0],
    'zero-student-first': [0], 'zero-id-first': [0],
  };
  state.submissions = Object.entries(scores).flatMap(([userId, values]) => values.map((score, index) => submission(`${userId}-${index}`, userId, state.assignments[index].id, score)));
  const ranked = calculateLeaderboard(state, '웹해킹');
  expect(ranked.map(entry => entry.userId)).toEqual(['total', 'average', 'lower-average', 'zero-more', 'zero-name-first', 'zero-student-first', 'zero-id-first', 'zero-name-last', 'ungraded']);
  expect(ranked.map(entry => entry.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, null]);
  state.users.reverse();
  state.submissions.reverse();
  expect(calculateLeaderboard(state, '웹해킹')).toEqual(ranked);
  state.submissions = [1, 2, 2].map((score, index) => submission(`fraction-${index}`, 'total', state.assignments[index].id, score));
  expect(calculateStudentRanking(state, 'total')?.averageScore).toBe(5 / 3);
});

test('score edits, reassignment and deletions are reflected directly without storing rankings', () => {
  const state = structuredClone(initialState);
  expect(calculateStudentRanking(state, 'minseo')?.rank).toBe(2);
  state.submissions.find(item => item.id === 'sub-5')!.score = 100;
  expect(calculateStudentRanking(state, 'minseo')).toMatchObject({ rank: 1, totalScore: 100 });
  state.users.find(user => user.id === 'minseo')!.track = '포너블';
  expect(calculateStudentRanking(state, 'minseo')).toMatchObject({ track: '포너블', rank: 1, rankedCount: 1, totalCount: 2 });
  expect(calculateStudentRanking(state, 'hanna')).toMatchObject({ rank: 1, totalCount: 1 });
  state.assignments = state.assignments.filter(assignment => assignment.id !== 'sys-02');
  expect(calculateStudentRanking(state, 'minseo')).toMatchObject({ rank: null, totalScore: 0 });
  state.users = state.users.filter(user => user.id !== 'minseo');
  expect(calculateLeaderboard(state, '포너블').map(entry => entry.userId)).toEqual(['jihoon']);
  expect(calculateStudentRanking(state, 'minseo')).toBeNull();
});

test('calculation preserves source data and omits private account fields from results', () => {
  const state = fixture();
  state.submissions = [
    submission('real', 'hanna', 'web-03', 90),
    submission('deleted-assignment', 'hanna', 'missing', 100),
    submission('deleted-user', 'missing', 'web-03', 100),
    submission('invalid-time', 'hanna', 'sys-02', 100, { submittedAt: 'invalid' }),
  ];
  const before = structuredClone(state);
  function freeze(value: unknown) {
    if (!value || typeof value !== 'object') return;
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  freeze(state);
  const entries = calculateLeaderboard(state, '웹해킹');
  expect(entries[0]).toMatchObject({ userId: 'hanna', totalScore: 90, reviewedCount: 1 });
  expect(Object.keys(entries[0]).sort()).toEqual(['averageScore', 'name', 'rank', 'reviewedCount', 'totalScore', 'track', 'userId']);
  calculateStudentRanking(state, 'hanna');
  expect(state).toEqual(before);
});
