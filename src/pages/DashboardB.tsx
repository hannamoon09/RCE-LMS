import { useRef } from "react";
import { Activity, FileText } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { AssignmentList } from "@/components/dashboard/AssignmentList";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { FocusPanel } from "@/components/dashboard/FocusPanel";
import { NoticeActivity } from "@/components/dashboard/NoticeActivity";
import { RouteTabs } from "@/components/dashboard/RouteTabs";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { Card } from "@/components/ui/card";
import { useLearningData } from '@/data/useLearningData';
import { useDashboardAnimation } from "@/hooks/useDashboardAnimation";

export function DashboardB() {
  const root = useRef<HTMLDivElement>(null);
  useDashboardAnimation(root, "dashboard-b");

  return (
    <AppShell density="compact">
      <div ref={root}>
        <DashboardHeader compact />
        <RouteTabs />
        <div className="grid gap-4 px-4 pb-8 sm:px-6 xl:grid-cols-[16rem_minmax(0,1fr)_18rem]">
          <aside className="min-w-0 space-y-4">
            <SummaryCards variant="compact" />
            <SignalPanel />
          </aside>
          <section className="min-w-0 space-y-4">
            <AssignmentList mode="table" />
            <NoticeActivity />
          </section>
          <aside className="min-w-0 space-y-4">
            <FocusPanel variant="platform" />
            <Card className="motion-panel rce-surface p-5">
              <div className="mb-4 flex items-center gap-3">
                <FileText className="h-4 w-4 text-accent" />
                <h2 className="app-section-title font-semibold">제출 전 확인</h2>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                과제 파일을 제출하고 궁금한 점은 선택 메모로 남겨 주세요. 제출한 과제의 검토 결과는 내 제출물에서 확인할 수 있습니다.
              </p>
            </Card>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

function SignalPanel() {
  const { submissions } = useLearningData();
  const summary = [{ label: '검토 대기', status: 'pending' }, { label: '검토 완료', status: 'reviewed' }];
  return (
    <Card className="motion-panel rce-surface p-4">
      <div className="flex items-center gap-3">
        <Activity className="h-4 w-4 text-accent" />
        <h2 className="font-display text-sm font-semibold tracking-tight">제출물 검토 현황</h2>
      </div>
      <div className="mt-5 space-y-3">
        {summary.map(({ label, status }) => (
          <div key={label} className="flex items-center justify-between rounded-md bg-background/48 px-3 py-2">
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className="text-sm font-medium tabular-nums">{submissions.filter(submission => submission.status === status).length}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
