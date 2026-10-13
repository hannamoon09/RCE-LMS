import { Link } from 'react-router-dom';
import { useLearningData } from '@/data/useLearningData';

export function SummaryCards() {
  const { assignments } = useLearningData();
  const missing = assignments.filter(a => a.status === 'missing').length;
  const submitted = assignments.length - missing;
  return <section aria-label="과제 요약" className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-5 border-t border-border pt-5 lg:block">
    <Link data-summary="missing" to="/assignments?status=missing" aria-label={`미제출 과제 ${missing}개`} className="summary-primary block rounded-sm pb-2 lg:pb-5 hover:text-accent">
      <span className="text-sm text-muted-foreground">미제출 과제</span>
      <span className="app-number platinum-number mt-4 block">{String(missing).padStart(2, '0')}</span>
    </Link>
    <div className="summary-secondary flex gap-5 self-end border-l border-border-subtle pb-2 pl-5 lg:border-l-0 lg:border-t lg:pb-0 lg:pl-0 lg:pt-4">
      <Link data-summary="total" to="/assignments" aria-label={`전체 과제 ${assignments.length}개`} className="min-w-0 rounded-sm hover:text-foreground/75"><span className="app-meta block">전체 과제</span><span className="app-number mt-2 block">{String(assignments.length).padStart(2, '0')}</span></Link>
      <Link data-summary="submitted" to="/assignments?status=submitted" aria-label={`제출 완료 ${submitted}개`} className="min-w-0 rounded-sm hover:text-foreground/75"><span className="app-meta block">제출 완료</span><span className="app-number mt-2 block">{String(submitted).padStart(2, '0')}</span></Link>
    </div>
  </section>;
}
