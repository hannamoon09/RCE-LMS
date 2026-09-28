import { useRef } from "react";
import { Crosshair, MoveUpRight } from "lucide-react";
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

export function DashboardD() {
  const root = useRef<HTMLDivElement>(null);
  useDashboardAnimation(root, "dashboard-d");

  return (
    <AppShell density="brand">
      <div ref={root}>
        <DashboardHeader eyebrow="RCE Control Layer" />
        <RouteTabs />
        <div className="grid gap-5 px-5 pb-8 sm:px-8 xl:grid-cols-[0.9fr_1.1fr]">
          <section className="min-w-0 space-y-5">
            <BrandSignal />
            <SummaryCards variant="brand" />
            <NoticeActivity brand />
          </section>
          <section className="min-w-0 space-y-5">
            <AssignmentList mode="brand" />
            <FocusPanel variant="brand" />
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function BrandSignal() {
  const { user } = useLearningData();
  return (
    <Card className="motion-panel pixel-edge rce-surface rce-diagonal overflow-hidden p-5">
      <div className="flex items-start justify-between gap-5">
        <div>
          <p className="app-eyebrow font-mono text-xs text-accent">RCE / ACTIVE WINDOW</p>
          <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight">{user.track} 학습 워크스페이스</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            등록된 과제를 확인하고 파일과 학습 메모를 제출하세요. 제출부터 운영진 피드백까지 한곳에서 확인할 수 있습니다.
          </p>
        </div>
        <div className="hidden h-16 w-16 shrink-0 place-items-center border border-primary/30 bg-background/55 sm:grid">
          <Crosshair className="h-7 w-7 text-primary" />
        </div>
      </div>
      <div className="mt-6 grid grid-cols-6 gap-2" aria-hidden="true">
        {Array.from({ length: 18 }).map((_, index) => (
          <span
            key={index}
            className="motion-line h-2 bg-primary/80"
            style={{ opacity: index % 4 === 0 ? 0.32 : 0.86 }}
          />
        ))}
      </div>
      <div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
        <MoveUpRight className="h-4 w-4 text-accent" />
        학습 기록은 과제 제출과 피드백으로 쌓입니다.
      </div>
    </Card>
  );
}
