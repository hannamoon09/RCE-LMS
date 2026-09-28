import { test, expect } from '@playwright/test';
import { initialState, isLMSState, migrateLMSState, selectLearningData } from '../src/data/lmsData';

test('submission status belongs to the learner, not the assignment or its review result', () => {
  const hanna = selectLearningData(initialState, 'hanna');
  const minseo = selectLearningData(initialState, 'minseo');
  expect(hanna.assignments.find(a => a.id === 'web-03')?.status).toBe('missing');
  expect(minseo.assignments.find(a => a.id === 'web-03')?.status).toBe('submitted');
  expect(hanna.assignments.find(a => a.id === 'web-02')?.submittedAt).toBe(initialState.submissions.find(s => s.id === 'sub-2')?.submittedAt);
  const seojun = selectLearningData(initialState, 'seojun');
  expect(seojun.submissions.find(s => s.assignmentId === 'net-01')?.status).toBe('reviewed');
  expect(seojun.assignments.find(a => a.id === 'net-01')?.status).toBe('submitted');
  expect(hanna.submissions.map(s => s.assignmentId)).toEqual(['sys-02', 'web-02']);
  expect(hanna.activities.every(a => a.userId === 'hanna')).toBe(true);
  expect(hanna.activities[0]).toMatchObject({ assignmentId: 'sys-02', kind: 'submitted' });
  expect(selectLearningData(initialState, 'unknown')).toMatchObject({ assignments: [], submissions: [], notices: [], activities: [] });
});

test('valid field reassignment keeps records and invalid field data is rejected', () => {
  const state = structuredClone(initialState);
  state.users.find(u => u.id === 'hanna')!.track = '포너블';
  expect(isLMSState(state)).toBe(true);
  expect(selectLearningData(state).assignments.find(a => a.id === 'sys-02')?.status).toBe('submitted');
  expect(state.submissions).toEqual(initialState.submissions);
  expect(migrateLMSState({ ...state, users: state.users.map(user => ({ ...user, track: 'Network' })) })).toBeNull();
  expect(migrateLMSState({ ...state, assignments: state.assignments.map(a => ({ ...a, deadline: 'invalid' })) })).toBeNull();
});

test('version-two migration preserves records and real file references while retiring generated attachments and review state', () => {
  const savedFile = { id: 'real-upload', name: 'lab.pdf', type: 'application/pdf', size: 123 };
  const old = {
    ...structuredClone(initialState), version: 2,
    assignments: initialState.assignments.map((assignment, index) => ({
      ...assignment, course: '웹해킹 03주차', week: 3, track: '웹해킹', progress: 80, requirements: ['분석하기'],
      attachment: { name: `${assignment.id}.md`, content: assignment.description },
      attachments: index === 0 ? [savedFile] : [],
    })),
    users: initialState.users.map(({ profileImage: _image, ...user }) => ({ ...user, ...(user.id === 'hanna' ? { name: '저장된 사용자' } : {}) })),
    submissions: initialState.submissions.map(submission => submission.id === 'sub-4' ? { ...submission, status: 'revision' } : submission),
    activities: initialState.activities.map(activity => ({ id: activity.id, userId: activity.userId, at: activity.at, title: activity.kind === 'feedback' ? '피드백 도착' : '제출 완료', href: `/assignments/${activity.assignmentId}?saved=true` })),
  };
  const migrated = migrateLMSState(old)!;
  expect(isLMSState(migrated)).toBe(true);
  expect(migrated.version).toBe(3);
  expect(migrated.assignments[0].attachments).toEqual([savedFile]);
  expect(migrated.assignments.slice(1).every(assignment => assignment.attachments.length === 0)).toBe(true);
  for (const assignment of migrated.assignments) {
    for (const field of ['course', 'week', 'track', 'progress', 'requirements', 'attachment']) expect(assignment).not.toHaveProperty(field);
  }
  expect(migrated.assignments.map(assignment => assignment.description)).toEqual(initialState.assignments.map(assignment => assignment.description));
  expect(migrated.submissions).toEqual(initialState.submissions);
  expect(migrated.activities).toEqual(initialState.activities);
  expect(migrated.users.find(user => user.id === 'hanna')).toMatchObject({ name: '저장된 사용자', track: '웹해킹', active: true, profileImage: null });
});
