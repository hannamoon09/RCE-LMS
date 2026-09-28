import { Link } from 'react-router-dom';
import { activityLabels, formatDate } from '@/data/lmsData';
import { useLearningData } from '@/data/useLearningData';
import { ReviewBadge, SectionHeading } from '@/components/shared/Primitives';
import { cn } from '@/lib/utils';

export function NoticeActivity({ compact = false, brand: _brand = false }: { compact?: boolean; brand?: boolean }) {
  const { assignments, notices, submissions, activities } = useLearningData();
  const recentNotices = [...notices].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  const recentSubmissions = [...submissions].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).slice(0, 3);
  const recentActivities = [...activities].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 3);
  return <div className={cn('grid gap-10', !compact && 'xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] xl:gap-14')}>
    <section className="min-w-0"><SectionHeading title="최근 공지" href="/notices" /><ul className="divide-y divide-border-subtle">{recentNotices.map(notice => <li key={notice.id}><Link to={`/notices/${notice.id}`} className="row-link block py-5 hover:text-foreground/75"><div className="mb-2 flex flex-wrap justify-between gap-2"><p className="app-meta">{notice.important && '중요 · '}{notice.track === 'all' ? '공통 공지' : notice.track}</p><time className="app-meta" dateTime={notice.date}>{formatDate(notice.date)}</time></div><p className="app-item-title text-base leading-7 [overflow-wrap:anywhere]">{notice.title}</p></Link></li>)}</ul>{!recentNotices.length && <p className="py-5 text-sm text-muted-foreground">등록된 공지가 없습니다.</p>}</section>
    <div className="min-w-0 space-y-10">
      <section><SectionHeading title="최근 제출물" href="/submissions" /><ul className="divide-y divide-border-subtle">{recentSubmissions.map(submission => { const assignment = assignments.find(a => a.id === submission.assignmentId); if (!assignment) return null; return <li key={submission.id}><Link className="row-link block py-4 hover:text-foreground/75" to={`/assignments/${assignment.id}`}><p className="app-item-title [overflow-wrap:anywhere]">{assignment.title}</p><div className="mt-2 flex flex-wrap items-center justify-between gap-2"><time className="app-meta" dateTime={submission.submittedAt}>{formatDate(submission.submittedAt, true)}</time><ReviewBadge status={submission.status} /></div></Link></li>; })}</ul>{!recentSubmissions.length && <p className="py-5 text-sm text-muted-foreground">아직 제출한 과제가 없습니다.</p>}</section>
      <section><SectionHeading title="최근 활동" href="/profile" /><ul className="divide-y divide-border-subtle">{recentActivities.map(activity => { const assignment = assignments.find(item => item.id === activity.assignmentId); if (!assignment) return null; return <li key={activity.id}><Link className="row-link block py-4 hover:text-foreground/75" to={`/assignments/${assignment.id}`}><p className="app-item-title [overflow-wrap:anywhere]">{assignment.title}</p><div className="mt-2 flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{activityLabels[activity.kind]}</span><time className="app-meta" dateTime={activity.at}>{formatDate(activity.at, true)}</time></div></Link></li>; })}</ul>{!recentActivities.length && <p className="py-5 text-sm text-muted-foreground">활동 기록이 없습니다.</p>}</section>
    </div>
  </div>;
}
