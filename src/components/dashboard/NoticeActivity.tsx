import { Link } from 'react-router-dom';
import { formatDate } from '@/data/lmsData';
import { useLearningData } from '@/data/useLearningData';
import { ActivityLabel, ReviewBadge, SectionHeading } from '@/components/shared/Primitives';
import { cn } from '@/lib/utils';

export function RecentNotices() {
  const { notices } = useLearningData();
  const recent = [...notices].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  return <section aria-label="최근 공지" className="min-w-0">
    <SectionHeading title="최근 공지" href="/notices" />
    <ul className="divide-y divide-border-subtle">{recent.map(notice => <li key={notice.id}>
      <Link to={`/notices/${notice.id}`} className="row-link grid grid-cols-[minmax(0,1fr)_auto] gap-x-5 gap-y-3 py-4 sm:grid-cols-[minmax(0,1fr)_6rem_4.5rem] sm:items-center">
        <p className="app-item-title col-span-2 min-w-0 text-sm [overflow-wrap:anywhere] sm:col-span-1">{notice.important && <span className="mr-2 border-l-2 border-accent pl-2 text-[13px] font-normal text-muted-foreground">중요</span>}{notice.title}</p>
        <span className="app-meta sm:text-right">{notice.track === 'all' ? '공통 공지' : notice.track}</span><time className="app-meta whitespace-nowrap text-right" dateTime={notice.date}>{formatDate(notice.date)}</time>
      </Link>
    </li>)}</ul>
    {!recent.length && <p className="py-4 text-sm text-muted-foreground">등록된 공지가 없습니다.</p>}
  </section>;
}

export function RecentSubmissions() {
  const { assignments, submissions } = useLearningData();
  const recent = [...submissions].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).slice(0, 3);
  return <section aria-label="최근 제출물" className="min-w-0">
    <SectionHeading title="최근 제출물" href="/submissions" />
    <ul className="divide-y divide-border-subtle">{recent.map(submission => {
      const assignment = assignments.find(a => a.id === submission.assignmentId);
      if (!assignment) return null;
      return <li key={submission.id}><Link className="row-link block py-4" to={`/assignments/${assignment.id}`}>
        <p className="app-item-title text-sm [overflow-wrap:anywhere]">{assignment.title}</p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><time className="app-meta" dateTime={submission.submittedAt}>{formatDate(submission.submittedAt, true)}</time><ReviewBadge status={submission.status} /></div>
      </Link></li>;
    })}</ul>
    {!recent.length && <p className="py-4 text-sm text-muted-foreground">아직 제출한 과제가 없습니다.</p>}
  </section>;
}

export function RecentActivities() {
  const { assignments, activities } = useLearningData();
  const recent = [...activities].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 3);
  return <section aria-label="최근 활동" className="min-w-0">
    <SectionHeading title="최근 활동" href="/profile" />
    <ul className="divide-y divide-border-subtle">{recent.map(activity => {
      const assignment = assignments.find(item => item.id === activity.assignmentId);
      if (!assignment) return null;
      return <li key={activity.id}><Link className="row-link block py-4" to={`/assignments/${assignment.id}`}>
        <p className="app-item-title text-sm [overflow-wrap:anywhere]">{assignment.title}</p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><ActivityLabel kind={activity.kind} /><time className="app-meta" dateTime={activity.at}>{formatDate(activity.at, true)}</time></div>
      </Link></li>;
    })}</ul>
    {!recent.length && <p className="py-4 text-sm text-muted-foreground">활동 기록이 없습니다.</p>}
  </section>;
}

// Retained for the existing comparison dashboards.
export function NoticeActivity({ compact = false, brand: _brand = false }: { compact?: boolean; brand?: boolean }) {
  return <div className="space-y-8"><RecentNotices /><div className={cn('grid gap-8', !compact && 'md:grid-cols-2')}><RecentSubmissions /><RecentActivities /></div></div>;
}
