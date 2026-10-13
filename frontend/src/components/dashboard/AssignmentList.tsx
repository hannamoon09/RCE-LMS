import { useLearningData } from '@/data/useLearningData';
import { type LearnerAssignment } from '@/data/lmsData';
import { AssignmentCard } from '@/components/shared/AssignmentCard';
import { AssignmentRow } from '@/components/shared/AssignmentRow';
import { SectionHeading } from '@/components/shared/Primitives';

export function AssignmentList() {
  const { assignments } = useLearningData();
  const now = Date.now();
  const missing = assignments.filter(assignment => assignment.status === 'missing');
  // Use the same deadline boundary as the detail page and submission guard.
  const upcoming = missing.filter(assignment => new Date(assignment.deadline).getTime() >= now)
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
  const overdue = missing.filter(assignment => new Date(assignment.deadline).getTime() < now)
    .sort((a, b) => new Date(b.deadline).getTime() - new Date(a.deadline).getTime());
  const emptyMessage = overdue.length ? '예정된 미제출 과제가 없습니다.' : assignments.length ? '모든 과제를 제출했습니다' : '아직 등록된 과제가 없습니다';
  const renderAssignments = (items: LearnerAssignment[], featured = false) => {
    const visible = items.slice(0, 3);
    if (featured) return <div><AssignmentCard assignment={visible[0]} featured /><div className="mt-3">{visible.slice(1).map(assignment => <AssignmentRow key={assignment.id} assignment={assignment} />)}</div></div>;
    return <div>{visible.map(assignment => <AssignmentRow key={assignment.id} assignment={assignment} />)}</div>;
  };
  return <div className="min-w-0 space-y-6">
    <section aria-label="다음 과제" className="min-w-0"><SectionHeading title="다음 과제" meta={`${upcoming.length}`} href="/assignments?status=missing" />
      {upcoming.length ? renderAssignments(upcoming, true) : <p className="py-4 text-sm leading-6 text-muted-foreground">{emptyMessage}</p>}
    </section>
    {overdue.length > 0 && <section aria-label="기한 지난 과제" className="min-w-0"><SectionHeading title="기한 지난 과제" meta={`${overdue.length}`} href="/assignments?status=missing" />{renderAssignments(overdue)}</section>}
  </div>;
}
