import { test, expect } from '@playwright/test';
import { selectLearningData, type LMSState, type LMSUser, type Notice } from '../src/data/lmsData';
import { compareNotices } from '../src/api/notices';

const account = (id: string): LMSUser => ({ id, name: id, initials: id, studentId: '12345678', email: '', role: 'member', track: '웹해킹', active: true, joinedAt: '2026-01-01T00:00:00Z', profileImage: null });
test('learner status and activity follow their own submissions, including reviewed zero and missing references', () => {
  const state: LMSState = {
    users: [account('learner-one'), account('learner-two')],
    assignments: ['task-a', 'task-b'].map(id => ({ id, title: id, description: 'Test-owned fixture', difficulty: 'Low', deadline: '2026-12-01T00:00:00Z', author: '운영진', attachments: [] })),
    submissions: [
      { id: 'sub-a', assignmentId: 'task-a', userId: 'learner-one', submittedAt: '2026-10-01T00:00:00Z', files: [], status: 'reviewed', score: 0, feedback: '확인' },
      { id: 'sub-b', assignmentId: 'task-b', userId: 'learner-two', submittedAt: '2026-10-02T00:00:00Z', files: [], status: 'pending', score: null, feedback: '' },
      { id: 'removed', assignmentId: 'unknown', userId: 'learner-one', submittedAt: '2026-10-03T00:00:00Z', files: [], status: 'pending', score: null, feedback: '' },
    ],
    activities: [{ id: 'act-a', userId: 'learner-one', assignmentId: 'task-a', kind: 'feedback', at: '2026-10-02T00:00:00Z' }, { id: 'act-b', userId: 'learner-two', assignmentId: 'task-b', kind: 'submitted', at: '2026-10-02T00:00:00Z' }],
  };
  const before = structuredClone(state);
  const one = selectLearningData(state, 'learner-one');
  const two = selectLearningData(state, 'learner-two');
  expect(one.assignments.map(item => item.status)).toEqual(['submitted', 'missing']);
  expect(two.assignments.map(item => item.status)).toEqual(['missing', 'submitted']);
  expect(one.assignments[0].submittedAt).toBe(state.submissions[0].submittedAt);
  expect(one.submissions).toHaveLength(1);
  expect(one.submissions[0]).toMatchObject({ status: 'reviewed', score: 0 });
  expect(one.activities).toEqual([state.activities[0]]);
  expect(selectLearningData(state, 'unknown')).toMatchObject({ assignments: [], submissions: [], notices: [], activities: [] });
  expect(state).toEqual(before);
});

test('notice priority edits retain newest-first ordering and a deterministic ID tie break', () => {
  const notice = (id: string, date: string, important: boolean): Notice => ({ id, date, important, title: id, author: '운영진', category: '안내', track: '웹해킹', body: ['본문'] });
  const rows = [notice('older', '2026-10-01T00:00:00Z', true), notice('b', '2026-10-02T00:00:00Z', false), notice('a', '2026-10-02T00:00:00Z', false)];
  expect([...rows].sort(compareNotices).map(row => row.id)).toEqual(['older', 'a', 'b']);
  rows[0].important = false;
  expect([...rows].sort(compareNotices).map(row => row.id)).toEqual(['a', 'b', 'older']);
});
