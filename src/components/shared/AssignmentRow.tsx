import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { type LearnerAssignment, deadlineLabel, formatDate } from '@/data/lmsData';
import { StatusBadge } from './Primitives';

export function AssignmentRow({ assignment }: { assignment: LearnerAssignment }) {
  return <Link to={`/assignments/${assignment.id}`} className="assignment-row row-link grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-5 gap-y-3 border-b border-border-subtle py-5 transition-colors hover:bg-secondary/20 sm:grid-cols-[minmax(0,1fr)_10rem_5rem_auto]">
    <div className="min-w-0"><h3 className="app-item-title text-base [overflow-wrap:anywhere]">{assignment.title}</h3><p className="app-meta mt-2">난이도 {assignment.difficulty}</p></div>
    <p className="app-meta col-start-1 row-start-2 sm:col-auto sm:row-auto">{assignment.submittedAt ? `제출 ${formatDate(assignment.submittedAt, true)}` : `마감 ${formatDate(assignment.deadline, true)}`}</p>
    <div className="col-start-2 row-span-2 row-start-1 space-y-2 text-right sm:col-auto sm:row-auto"><StatusBadge status={assignment.status} />{!assignment.submittedAt && <p className="text-sm font-medium tabular-nums">{deadlineLabel(assignment.deadline)}</p>}</div>
    <ArrowUpRight aria-hidden="true" size={15} className="hidden text-muted-foreground sm:block" />
  </Link>;
}
