import { Link } from 'react-router-dom';
import { UserAvatar } from '@/components/profile/UserAvatar';
import { todayLabel } from '@/data/uiData';
import { useLearningData } from '@/data/useLearningData';
import { PageTitleReveal } from '@/motion/PageTitleReveal';

export function DashboardHeader() {
  const { user } = useLearningData();
  return <header className="dashboard-header px-5 pb-6 pt-6 sm:px-8 sm:pb-8 sm:pt-8">
    <p className="app-eyebrow rce-section-code mb-5">01 / DASHBOARD</p>
    <div className="flex items-end justify-between gap-5">
      <div className="min-w-0"><PageTitleReveal title={user.name} documentTitle="대시보드" className="app-title dashboard-title" /><p className="mt-3 text-sm text-muted-foreground">{user.track}</p></div>
      <div className="flex shrink-0 items-center gap-4"><p className="app-meta hidden sm:block">{todayLabel}</p><Link to="/profile" aria-label="내 프로필"><UserAvatar user={user} /></Link></div>
    </div>
  </header>;
}
