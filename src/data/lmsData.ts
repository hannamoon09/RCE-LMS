import { notices as noticeTitles, type AssignmentStatus } from './mockData';
export type FileMetadata = { id?: string; name: string; size: number; type: string };

export const tracks = ['웹해킹', '포너블', '리버싱', '포렌식'] as const;
export type Track = typeof tracks[number];
export type Role = 'member' | 'staff';
export type ReviewStatus = 'pending' | 'reviewed';
export type LMSAssignment = {
  id: string;
  title: string;
  difficulty: 'Low' | 'Medium' | 'High';
  author: string;
  deadline: string;
  description: string;
  attachments: FileMetadata[];
};
export type LearnerAssignment = LMSAssignment & { status: AssignmentStatus; submittedAt?: string };
export type LMSUser = { id: string; name: string; initials: string; studentId: string; email: string; role: Role; track: Track; active: boolean; joinedAt: string; profileImage: FileMetadata | null };
export type SubmissionFile = FileMetadata;
export type Submission = { id: string; assignmentId: string; userId: string; submittedAt: string; text?: string; files: SubmissionFile[]; status: ReviewStatus; score: number | null; feedback: string };
export type Notice = { id: string; title: string; important: boolean; author: string; date: string; category: string; track: Track | 'all'; body: string[] };
export type ActivityKind = 'submitted' | 'feedback';
export type ActivityItem = { id: string; userId: string; assignmentId: string; kind: ActivityKind; at: string };
export const activityLabels: Record<ActivityKind, string> = { submitted: '제출 완료', feedback: '피드백 도착' };
export type Preferences = { assignment: boolean; notice: boolean; feedback: boolean; email: boolean };
export type LMSState = { version: 3; assignments: LMSAssignment[]; submissions: Submission[]; users: LMSUser[]; activities: ActivityItem[]; preferences: Preferences };
export const currentUserId = 'hanna';
export const roleLabels: Record<Role, string> = { member: '학습자', staff: '운영진' };
export const reviewLabels: Record<ReviewStatus, string> = { pending: '검토 대기', reviewed: '검토 완료' };
export const isTrack = (value: unknown): value is Track => typeof value === 'string' && tracks.includes(value as Track);
const relativeDate = (days: number, hour = 23) => { const date = new Date(); date.setDate(date.getDate() + days); date.setHours(hour, 59, 0, 0); return date.toISOString(); };
export const formatDate = (value: string, time = false) => new Intl.DateTimeFormat('ko-KR', { month: '2-digit', day: '2-digit', ...(time ? { hour: '2-digit', minute: '2-digit' } : {} ) }).format(new Date(value));
export function deadlineLabel(value: string) { const due = new Date(value); const now = new Date(); if (due.getTime() < now.getTime()) return '마감'; const days = Math.round((Date.UTC(due.getFullYear(), due.getMonth(), due.getDate()) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000); return days === 0 ? '오늘 마감' : `D-${days}`; }
export function isUrgent(assignment: Pick<LearnerAssignment, 'status' | 'deadline'>) { const remaining = new Date(assignment.deadline).getTime() - Date.now(); return assignment.status !== 'submitted' && remaining >= 0 && remaining <= 48 * 3600000; }

type AssignmentFixture = Omit<LMSAssignment, 'author' | 'deadline' | 'attachments'> & { days: number };
const assignmentFixtures: AssignmentFixture[] = [
  { id: 'web-03', title: 'SQL Injection', difficulty: 'High', days: 1, description: '입력값이 SQL 쿼리로 처리되는 과정을 분석하고, 제공된 실습 환경에서 SQL Injection 취약점의 원인과 대응 방법을 정리합니다.' },
  { id: 'sys-02', title: 'Stack Buffer Overflow', difficulty: 'Medium', days: 5, description: '스택 메모리의 구조를 살펴보고, 버퍼 경계 검증이 프로그램 실행 흐름에 미치는 영향을 분석합니다.' },
  { id: 'net-01', title: 'Packet Analysis', difficulty: 'Medium', days: 7, description: '제공된 네트워크 증거 파일에서 통신 흐름을 복원하고, 관찰한 패킷을 근거로 사건의 시간 순서를 정리합니다.' },
  { id: 'web-02', title: 'XSS Write-up', difficulty: 'Medium', days: -3, description: '입력과 출력의 흐름을 추적하고, XSS가 발생하는 조건과 컨텍스트별 출력 인코딩 방법을 정리합니다.' },
  { id: 'sys-03', title: 'ELF Binary Analysis', difficulty: 'High', days: 9, description: 'ELF 실행 파일의 헤더와 섹션 구조를 분석하고, 정적 분석으로 확인한 내용을 실행 결과와 비교합니다.' },
  { id: 'net-02', title: 'TLS Traffic Evidence', difficulty: 'Low', days: 12, description: 'TLS 통신 기록의 인증서와 연결 메타데이터를 조사하여 확인 가능한 사실과 암호화로 확인할 수 없는 내용을 구분합니다.' },
  { id: 'pwn-03', title: 'Memory Protection Review', difficulty: 'Medium', days: 8, description: '교육용 바이너리의 메모리 보호 설정을 확인하고 각 보호 기법이 적용되는 지점을 비교합니다.' },
  { id: 'rev-02', title: 'Control Flow Reconstruction', difficulty: 'Medium', days: 6, description: '제공된 교육용 프로그램의 분기와 함수 호출 구조를 분석하여 주요 동작을 의사 코드로 복원합니다.' },
];
export const initialState: LMSState = {
  version: 3,
  assignments: assignmentFixtures.map(({ days, ...assignment }) => {
    const deadline = relativeDate(days);
    return { ...assignment, deadline, author: '김지훈', attachments: [] };
  }),
  users: [
    { id: 'hanna', name: 'Hanna', initials: 'HM', studentId: '20240031', email: 'hanna@rce.example', role: 'staff', track: '웹해킹', active: true, joinedAt: '2024-03-04', profileImage: null },
    { id: 'jihoon', name: '김지훈', initials: 'JH', studentId: '20230012', email: 'jihoon@rce.example', role: 'staff', track: '포너블', active: true, joinedAt: '2023-03-06', profileImage: null },
    { id: 'minseo', name: '박민서', initials: 'MS', studentId: '20240018', email: 'minseo@rce.example', role: 'member', track: '웹해킹', active: true, joinedAt: '2024-03-04', profileImage: null },
    { id: 'seojun', name: '이서준', initials: 'SJ', studentId: '20250042', email: 'seojun@rce.example', role: 'member', track: '포렌식', active: true, joinedAt: '2025-03-03', profileImage: null },
    { id: 'yujin', name: '최유진', initials: 'YJ', studentId: '20240027', email: 'yujin@rce.example', role: 'member', track: '리버싱', active: false, joinedAt: '2024-03-04', profileImage: null },
  ],
  submissions: [
    { id: 'sub-1', assignmentId: 'sys-02', userId: 'hanna', submittedAt: relativeDate(-1, 15), text: '스택 프레임과 경계 검사 결과를 정리했습니다. 디버거 로그 및 보호 기법 비교를 첨부합니다.', files: [{ name: 'stack-analysis.pdf', size: 248000, type: 'application/pdf' }], status: 'pending', score: null, feedback: '' },
    { id: 'sub-2', assignmentId: 'web-02', userId: 'hanna', submittedAt: relativeDate(-4, 20), text: 'XSS의 실행 조건과 출력 인코딩 적용 결과를 정리했습니다.', files: [{ name: 'xss-writeup.md', size: 8400, type: 'text/markdown' }], status: 'reviewed', score: 94, feedback: '재현 과정이 명확합니다. 컨텍스트별 인코딩 차이를 함께 정리한 점이 좋습니다. 다음 실습에서는 CSP 적용 결과도 비교해 보세요.' },
    { id: 'sub-3', assignmentId: 'web-03', userId: 'minseo', submittedAt: relativeDate(-1, 18), text: '입력 흐름 분석과 개선 방안을 정리했습니다.', files: [], status: 'pending', score: null, feedback: '' },
    { id: 'sub-4', assignmentId: 'net-01', userId: 'seojun', submittedAt: relativeDate(-2, 17), text: '프로토콜별 패킷 분석 결과입니다.', files: [], status: 'reviewed', score: 70, feedback: '탐지 근거가 되는 패킷 번호와 필터 조건을 추가해 주세요.' },
    { id: 'sub-5', assignmentId: 'sys-02', userId: 'minseo', submittedAt: relativeDate(-2, 19), text: '메모리 구조와 보호 기법을 비교했습니다.', files: [], status: 'reviewed', score: 88, feedback: '보호 기법 비교가 잘 정리되어 있습니다.' },
  ],
  activities: [
    { id: 'act-1', userId: 'hanna', assignmentId: 'sys-02', kind: 'submitted', at: relativeDate(-1, 15) },
    { id: 'act-2', userId: 'hanna', assignmentId: 'web-02', kind: 'feedback', at: relativeDate(-3, 18) },
    { id: 'act-3', userId: 'hanna', assignmentId: 'web-02', kind: 'submitted', at: relativeDate(-4, 20) },
  ],
  preferences: { assignment: true, notice: true, feedback: true, email: false },
};
export const noticeData: Notice[] = [
  { id: 'semester', title: noticeTitles[0], important: true, author: '김지훈', date: relativeDate(-1, 10), category: '운영 안내', track: 'all', body: ['이번 학기에는 웹해킹, 포너블, 리버싱, 포렌식 네 가지 트랙으로 실습을 진행합니다. 과제는 공통 학습 공간에서 확인하고, 공지는 전체 안내와 자신의 분야 안내를 확인할 수 있습니다.', '매주 월요일에 새로운 실습이 공개됩니다. 과제별 마감 시간을 확인하고, 분석 과정과 근거를 함께 정리해 주세요. 완성된 결과뿐 아니라 시도한 방법과 어려웠던 점도 학습에 중요한 기록입니다.', '정기 활동은 매주 수요일 오후 7시에 진행합니다. 실습 전 개인 개발 환경을 확인해 주세요. 참여가 어려운 경우 운영진에게 미리 알려주시기 바랍니다.', '실습 자료와 계정은 동아리 교육 목적으로만 사용합니다. 자세한 준비 사항은 각 과제의 첨부 가이드를 참고해 주세요.'] },
  { id: 'submission-guide', title: noticeTitles[1], important: true, author: '김지훈', date: relativeDate(-2, 14), category: '과제 안내', track: '웹해킹', body: ['웹해킹 과제 상세 화면의 제출하기 버튼을 통해 분석 내용과 파일을 함께 제출할 수 있습니다.', '파일로 과제를 제출하고, 메모와 질문은 필요한 경우 자유롭게 남겨 주세요. PDF, Markdown, 텍스트, 이미지 또는 ZIP 파일을 최대 5개까지 첨부할 수 있으며 파일당 최대 용량은 10MB입니다.', '제출 후 내 제출물에서 접수 시간과 검토 상태를 확인할 수 있습니다. 마감 전에는 다시 제출할 수 있으며, 새 제출은 이전 내용을 교체합니다.'] },
  { id: 'weekly-session', title: noticeTitles[2], important: false, author: '박민서', date: relativeDate(-3, 11), category: '활동 안내', track: 'all', body: ['이번 주 정기 활동에서는 각 트랙의 실습 기록과 분석 과정을 공유합니다.', '수요일 오후 7시, 공학관 스터디룸에서 만납니다. 노트북과 실습 기록을 준비해 주세요. 발표는 선택이며, 질문과 실습 중 발견한 내용을 자유롭게 공유할 수 있습니다.'] },
  { id: 'feedback', title: '웹해킹 지난 주 과제 피드백이 등록되었습니다', important: false, author: '김지훈', date: relativeDate(-4, 16), category: '과제 안내', track: '웹해킹', body: ['XSS Write-up 과제의 검토가 완료되었습니다. 내 제출물에서 점수와 피드백을 확인해 주세요.', '피드백을 확인한 뒤 궁금한 점이 있다면 다음 제출의 메모에 질문을 남겨 주세요.'] },
  { id: 'pwn-lab', title: '포너블 실습 환경 준비 안내', important: true, author: '김지훈', date: relativeDate(-1, 9), category: '실습 안내', track: '포너블', body: ['포너블 실습 전에 제공된 교육용 바이너리와 디버거 환경을 확인해 주세요.', '실행 로그와 메모리 보호 설정을 함께 기록하면 피드백을 받는 데 도움이 됩니다.'] },
  { id: 'reversing-tools', title: '리버싱 분석 기록 작성 안내', important: false, author: '김지훈', date: relativeDate(-2, 9), category: '과제 안내', track: '리버싱', body: ['리버싱 과제에는 주요 함수와 분기 조건, 분석 근거를 정리해 주세요.', '도구가 생성한 의사 코드는 직접 확인한 실행 결과와 비교하여 설명해 주세요.'] },
  { id: 'forensics-kit', title: '포렌식 증거 파일 취급 안내', important: true, author: '박민서', date: relativeDate(-2, 10), category: '실습 안내', track: '포렌식', body: ['포렌식 실습은 배포된 증거 파일의 복사본으로 진행합니다. 분석 전후 해시 값을 기록해 주세요.', '분석 보고서에는 시간대, 사용 도구, 주요 근거와 분석의 한계를 명시해 주세요.'] },
];

export function selectLearningData(state: LMSState, userId: string = currentUserId) {
  const user = state.users.find(candidate => candidate.id === userId);
  const availableAssignments = user ? state.assignments : [];
  const assignmentIds = new Set(availableAssignments.map(assignment => assignment.id));
  const submissions = state.submissions.filter(submission => submission.userId === userId && assignmentIds.has(submission.assignmentId)).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  const latest = new Map<string, Submission>();
  submissions.forEach(submission => { if (!latest.has(submission.assignmentId)) latest.set(submission.assignmentId, submission); });
  const assignments: LearnerAssignment[] = availableAssignments.map(assignment => {
    const submission = latest.get(assignment.id);
    return { ...assignment, status: submission ? 'submitted' : 'missing', ...(submission ? { submittedAt: submission.submittedAt } : {}) };
  });
  const notices = user ? noticeData.filter(notice => notice.track === 'all' || notice.track === user.track) : [];
  const activities = state.activities.filter(activity => activity.userId === userId && assignmentIds.has(activity.assignmentId)).sort((a, b) => b.at.localeCompare(a.at));
  return { user, assignments, submissions, notices, activities };
}

const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const validDate = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value));
export function isFileMetadata(value: unknown): value is FileMetadata {
  return record(value) && typeof value.name === 'string' && Boolean(value.name) && typeof value.type === 'string' && typeof value.size === 'number' && Number.isFinite(value.size) && value.size >= 0 && (value.id === undefined || typeof value.id === 'string' && Boolean(value.id));
}
export function isLMSAssignment(value: unknown): value is LMSAssignment {
  if (!record(value)) return false;
  return [value.id, value.title, value.author, value.description].every(item => typeof item === 'string') && Boolean(value.id) && validDate(value.deadline) && ['Low', 'Medium', 'High'].includes(String(value.difficulty)) && Array.isArray(value.attachments) && value.attachments.every(file => isFileMetadata(file) && Boolean(file.id)) && !['status', 'progress', 'course', 'week', 'track', 'category', 'requirements', 'tasks', 'performanceItems', 'due', 'attachment'].some(key => key in value);
}
export function isLMSState(value: unknown): value is LMSState {
  if (!record(value) || value.version !== 3 || !Array.isArray(value.assignments) || !Array.isArray(value.users) || !Array.isArray(value.submissions) || !Array.isArray(value.activities) || !record(value.preferences)) return false;
  const { assignments, users, preferences } = value;
  if (!assignments.every(isLMSAssignment) || new Set(assignments.map(a => a.id)).size !== assignments.length) return false;
  if (!users.every(user => record(user) && [user.id, user.name, user.initials, user.studentId, user.email].every(item => typeof item === 'string') && Boolean(user.id) && validDate(user.joinedAt) && ['member', 'staff'].includes(String(user.role)) && isTrack(user.track) && typeof user.active === 'boolean' && (user.profileImage === null || isFileMetadata(user.profileImage) && Boolean(user.profileImage.id))) || !users.some(user => user.id === currentUserId) || new Set(users.map(user => user.id)).size !== users.length) return false;
  if (!value.submissions.every(submission => record(submission) && typeof submission.id === 'string' && assignments.some(a => a.id === submission.assignmentId) && users.some(user => user.id === submission.userId) && validDate(submission.submittedAt) && (submission.text === undefined || typeof submission.text === 'string') && typeof submission.feedback === 'string' && ['pending', 'reviewed'].includes(String(submission.status)) && (submission.score === null || typeof submission.score === 'number' && Number.isFinite(submission.score) && submission.score >= 0 && submission.score <= 100) && Array.isArray(submission.files) && submission.files.every(isFileMetadata))) return false;
  if (!value.activities.every(activity => record(activity) && typeof activity.id === 'string' && users.some(user => user.id === activity.userId) && assignments.some(a => a.id === activity.assignmentId) && ['submitted', 'feedback'].includes(String(activity.kind)) && validDate(activity.at))) return false;
  return ['assignment', 'notice', 'feedback', 'email'].every(key => typeof preferences[key] === 'boolean');
}

/** Retired assignment fields and generated documents are never carried into the new model. */
export function migrateLMSState(value: unknown): LMSState | null {
  if (isLMSState(value)) return value;
  if (!record(value) || ![1, 2].includes(Number(value.version)) || !Array.isArray(value.assignments) || !Array.isArray(value.users) || !Array.isArray(value.submissions) || !Array.isArray(value.activities) || !record(value.preferences)) return null;
  if (!value.assignments.every(record) || !value.users.every(record) || !value.submissions.every(record) || !value.activities.every(record)) return null;
  const assignments = value.assignments.map(assignment => ({
    id: assignment.id, title: assignment.title, description: assignment.description, author: assignment.author, deadline: assignment.deadline, difficulty: assignment.difficulty,
    attachments: Array.isArray(assignment.attachments) ? assignment.attachments.filter(file => isFileMetadata(file) && Boolean(file.id)) : [],
  }));
  const users = value.users.map(user => ({
    ...user,
    track: isTrack(user.track) ? user.track : initialState.users.find(known => known.id === user.id)?.track || tracks[0],
    profileImage: isFileMetadata(user.profileImage) && user.profileImage.id ? user.profileImage : null,
  }));
  const submissions = value.submissions.map(submission => ({
    ...submission,
    text: typeof submission.text === 'string' ? submission.text : undefined,
    status: submission.status === 'revision' ? (submission.feedback || submission.score !== null ? 'reviewed' : 'pending') : submission.status,
  }));
  const activities = value.activities.flatMap(activity => {
    let assignmentId = activity.assignmentId;
    if (typeof assignmentId !== 'string' && typeof activity.href === 'string') {
      const match = /^\/assignments\/([^/?#]+)/.exec(activity.href);
      try { assignmentId = match ? decodeURIComponent(match[1]) : undefined; } catch { return []; }
    }
    if (!assignments.some(assignment => assignment.id === assignmentId)) return [];
    const kind = activity.kind === 'feedback' || typeof activity.title === 'string' && activity.title.includes('피드백') ? 'feedback' : 'submitted';
    return [{ id: activity.id, userId: activity.userId, assignmentId, kind, at: activity.at }];
  });
  const migrated = { version: 3, assignments, users, submissions, activities, preferences: value.preferences };
  return isLMSState(migrated) ? migrated : null;
}
