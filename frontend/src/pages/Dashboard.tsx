import { AssignmentList } from '@/components/dashboard/AssignmentList';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { RecentNotices, RecentSubmissions, RecentActivities } from '@/components/dashboard/NoticeActivity';
import { SummaryCards } from '@/components/dashboard/SummaryCards';
import { RankingPreview } from '@/components/dashboard/RankingPreview';

export function Dashboard() {
  return <div data-page="dashboard"><DashboardHeader /><div className="px-5 pb-8 sm:px-8">
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_15rem]">
      <div className="min-w-0"><AssignmentList /></div>
      <div className="grid min-w-0 gap-6 sm:grid-cols-2 lg:grid-cols-1"><SummaryCards /><RankingPreview /></div>
    </div>
    <div className="mt-8"><RecentNotices /></div>
    <div className="mt-8 grid gap-8 md:grid-cols-2"><RecentSubmissions /><RecentActivities /></div>
  </div></div>;
}
