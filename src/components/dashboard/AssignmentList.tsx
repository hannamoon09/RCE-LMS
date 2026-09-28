import { Link } from 'react-router-dom';
import { useLearningData } from '@/data/useLearningData';
import { AssignmentCard } from '@/components/shared/AssignmentCard';
import { AssignmentRow } from '@/components/shared/AssignmentRow';
import { SectionHeading, StatusBadge, EmptyState } from '@/components/shared/Primitives';
import { deadlineLabel } from '@/data/lmsData';

export function AssignmentList({ mode = 'cards' }: { mode?: 'cards' | 'table' | 'compact' | 'brand' | 'focus' }) {
  const { assignments } = useLearningData();
  const missing = assignments.filter(a => a.status === 'missing').sort((a, b) => a.deadline.localeCompare(b.deadline));
  const visible = missing.slice(0, 3);
  return <section className="min-w-0"><SectionHeading title={mode === 'focus' ? '다음 과제' : '미제출 과제'} meta={`${missing.length}`} href="/assignments?status=missing" />
    {visible.length === 0 ? <EmptyState title={assignments.length ? '모든 과제를 제출했습니다' : '아직 등록된 과제가 없습니다'} /> : mode === 'table' ? <div className="overflow-x-auto"><table className="data-table min-w-[420px]"><thead><tr><th>과제</th><th>마감</th><th>제출 상태</th></tr></thead><tbody>{visible.map(a => <tr key={a.id}><td><Link className="app-item-title" to={`/assignments/${a.id}`}>{a.title}</Link></td><td>{deadlineLabel(a.deadline)}</td><td><StatusBadge status={a.status} /></td></tr>)}</tbody></table></div> : mode === 'focus' ? <div><AssignmentCard assignment={visible[0]} featured /><div className="mt-3">{visible.slice(1).map(assignment => <AssignmentRow key={assignment.id} assignment={assignment} />)}</div></div> : <div>{visible.map(assignment => <AssignmentRow key={assignment.id} assignment={assignment} />)}</div>}
  </section>;
}
