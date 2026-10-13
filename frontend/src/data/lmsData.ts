import type { AssignmentStatus } from './uiData';
export type FileMetadata = { id?: string; name: string; size: number; type: string };
export type SelectedFile = FileMetadata & { source?: File };

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
export type Submission = { id: string; assignmentId: string; userId: string; submittedAt: string; reviewedAt?: string | null; text?: string; files: SubmissionFile[]; status: ReviewStatus; score: number | null; feedback: string };
export type Notice = { id: string; title: string; important: boolean; author: string; date: string; category: string; track: Track | 'all'; body: string[] };
export type ActivityKind = 'submitted' | 'feedback';
export type ActivityItem = { id: string; userId: string; assignmentId: string; kind: ActivityKind; at: string };
export const activityLabels: Record<ActivityKind, string> = { submitted: '제출 완료', feedback: '피드백 도착' };
export type Preferences = { assignment: boolean; notice: boolean; feedback: boolean; email: boolean };
export type LMSState = { assignments: LMSAssignment[]; submissions: Submission[]; users: LMSUser[]; activities: ActivityItem[] };
export const roleLabels: Record<Role, string> = { member: '학습자', staff: '운영진' };
export const reviewLabels: Record<ReviewStatus, string> = { pending: '검토 대기', reviewed: '검토 완료' };
export const formatDate = (value: string, time = false) => new Intl.DateTimeFormat('ko-KR', { month: '2-digit', day: '2-digit', ...(time ? { hour: '2-digit', minute: '2-digit' } : {} ) }).format(new Date(value));
export function deadlineLabel(value: string) { const due = new Date(value); const now = new Date(); if (due.getTime() < now.getTime()) return '마감'; const days = Math.round((Date.UTC(due.getFullYear(), due.getMonth(), due.getDate()) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000); return days === 0 ? '오늘 마감' : `D-${days}`; }
export function isUrgent(assignment: Pick<LearnerAssignment, 'status' | 'deadline'>) { const remaining = new Date(assignment.deadline).getTime() - Date.now(); return assignment.status !== 'submitted' && remaining >= 0 && remaining <= 48 * 3600000; }

export function selectLearningData(state: LMSState, userId: string, notices: Notice[] = []) {
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
  const activities = state.activities.filter(activity => activity.userId === userId && assignmentIds.has(activity.assignmentId)).sort((a, b) => b.at.localeCompare(a.at));
  return { user, assignments, submissions, notices, activities };
}
