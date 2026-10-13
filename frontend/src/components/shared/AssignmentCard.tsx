import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { type LearnerAssignment, formatDate } from '@/data/lmsData';
import { DeadlineLabel, StatusBadge } from './Primitives';
import { cn } from '@/lib/utils';
export function AssignmentCard({ assignment, featured = false }: { assignment: LearnerAssignment; featured?: boolean }) {
  return <Link to={`/assignments/${assignment.id}`} data-interactive className={cn('assignment-surface interactive-surface row-link group block border border-border bg-card p-4 hover:border-accent/50 active:bg-secondary sm:p-5', featured && 'p-5 sm:p-6')}>
    <div className="flex flex-wrap items-center justify-between gap-3"><DeadlineLabel assignment={assignment} /><StatusBadge status={assignment.status} /></div>
    <h3 className={cn('app-item-title mt-3 min-w-0 text-base [overflow-wrap:anywhere]', featured && 'font-display text-2xl font-semibold leading-tight sm:text-3xl')}>{assignment.title}</h3>
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground"><time dateTime={assignment.deadline}>마감 {formatDate(assignment.deadline, true)}</time><span>난이도 {assignment.difficulty}</span></div>
    {assignment.submittedAt && <p className="mt-3 text-sm text-success">제출일 {formatDate(assignment.submittedAt, true)}</p>}
    <div className="mt-4 border-t border-border-subtle pt-4 text-sm font-medium text-accent"><span className="inline-flex items-center gap-2"><span className="underline-offset-4 group-hover:underline group-focus-visible:underline">과제 확인</span><ArrowRight size={17} aria-hidden="true" /></span></div>
  </Link>;
}
