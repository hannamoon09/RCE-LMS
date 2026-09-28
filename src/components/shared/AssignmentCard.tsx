import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { type LearnerAssignment, deadlineLabel, formatDate, isUrgent } from '@/data/lmsData';
import { StatusBadge } from './Primitives';
import { cn } from '@/lib/utils';
export function AssignmentCard({ assignment, compact = false, featured = false }: { assignment: LearnerAssignment; compact?: boolean; featured?: boolean }) {
  const urgent = isUrgent(assignment);
  return <Link to={`/assignments/${assignment.id}`} data-interactive className={cn('assignment-surface interactive-surface row-link block border p-4 sm:p-5', urgent ? 'border-accent/30 bg-card' : 'border-border bg-card', compact && 'p-4', featured && 'px-5 py-6 sm:px-6 sm:py-7')}>
    <div className="flex items-center justify-between gap-2"><p className="text-xs text-muted-foreground">난이도 {assignment.difficulty}</p><ArrowUpRight size={16} className="shrink-0 text-muted-foreground" /></div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><h3 className={cn("app-item-title min-w-0 text-base [overflow-wrap:anywhere]", featured && "font-display text-2xl sm:text-3xl")}>{assignment.title}</h3><StatusBadge status={assignment.status} /></div>
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"><span>마감 {formatDate(assignment.deadline, true)}</span><span className={cn('ml-auto text-sm font-medium tabular-nums', urgent && 'text-accent')}>{deadlineLabel(assignment.deadline)}</span></div>
    {assignment.submittedAt && <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">제출일 {formatDate(assignment.submittedAt, true)}</p>}
  </Link>;
}
