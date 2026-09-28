import { useLocation } from 'react-router-dom';
import { AssignmentList } from '@/components/dashboard/AssignmentList';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { NoticeActivity } from '@/components/dashboard/NoticeActivity';
import { RouteTabs } from '@/components/dashboard/RouteTabs';
import { SummaryCards } from '@/components/dashboard/SummaryCards';
import { RankingPreview } from '@/components/dashboard/RankingPreview';

export function DashboardA() {
  const location = useLocation();
  return <div><DashboardHeader />{location.pathname === '/dashboard/a' && <RouteTabs />}<div className="px-5 pb-12 sm:px-8 sm:pb-16">
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_15rem] lg:grid-rows-[max-content_1fr] lg:gap-y-8 xl:gap-x-14">
      <div className="min-w-0 lg:col-start-2 lg:row-start-1"><SummaryCards /></div>
      <div className="min-w-0 lg:col-start-1 lg:row-span-2 lg:row-start-1"><AssignmentList mode="focus" /></div>
      <div className="min-w-0 lg:col-start-2 lg:row-start-2"><RankingPreview /></div>
    </div>
    <div className="mt-14 sm:mt-16"><NoticeActivity /></div>
  </div></div>;
}
