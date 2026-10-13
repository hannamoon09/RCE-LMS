import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { type LearnerAssignment, formatDate } from '@/data/lmsData';
import { DeadlineLabel, StatusBadge } from './Primitives';

export function AssignmentRow({ assignment }: { assignment: LearnerAssignment }) {
  return <Link to={`/assignments/${assignment.id}`} className="assignment-row row-link group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 border-b border-border-subtle py-4 transition-colors hover:bg-secondary/30 active:bg-secondary/60 sm:grid-cols-[minmax(0,1fr)_9.5rem_auto_auto]">
    <div className="min-w-0"><h3 className="app-item-title text-base [overflow-wrap:anywhere] group-hover:text-accent">{assignment.title}</h3><p className="mt-2 text-[13px] text-muted-foreground">난이도 {assignment.difficulty}</p></div>
    <p className="col-start-1 row-start-2 text-[13px] text-muted-foreground sm:col-auto sm:row-auto">{assignment.submittedAt ? `제출 ${formatDate(assignment.submittedAt, true)}` : `마감 ${formatDate(assignment.deadline, true)}`}</p>
    <div className="col-start-2 row-span-2 row-start-1 space-y-2 text-right sm:col-auto sm:row-auto"><StatusBadge status={assignment.status} />{!assignment.submittedAt && <p><DeadlineLabel assignment={assignment} /></p>}</div>
    <ArrowUpRight aria-hidden="true" size={15} className="hidden text-muted-foreground sm:block" />
  </Link>;
}
