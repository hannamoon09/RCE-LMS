import { useMemo } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { useLMS } from '@/data/LMSContext';
import { calculateStudentRanking } from '@/data/ranking';
import { SectionHeading } from '@/components/shared/Primitives';

export function RankingPreview() {
  const { state } = useLMS();
  const { user } = useAuth();
  const ranking = useMemo(() => user ? calculateStudentRanking(state, user.id) : null, [state, user?.id]);
  if (!ranking) return null;

  const hasScore = ranking.reviewedCount > 0;
  return <section data-ranking-preview aria-label="내 순위" className="min-w-0">
    <SectionHeading title="내 순위" href="/rankings" />
    <p className="app-meta text-muted-foreground">{ranking.track}</p>
    <div className="mt-4 flex items-baseline gap-2">
      <p className="app-number platinum-number text-4xl" data-ranking-rank>{ranking.rank === null ? '—' : String(ranking.rank).padStart(2, '0')}<span className="sr-only">{ranking.rank === null ? ' 미채점' : '위'}</span></p>
      {ranking.rank !== null && <p className="app-meta text-muted-foreground">/ {String(ranking.rankedCount).padStart(2, '0')}<span className="sr-only">명</span></p>}
    </div>
    <p className="app-meta mt-2 text-muted-foreground">{ranking.rank === null ? '미채점' : `채점된 ${ranking.rankedCount}명 기준`}</p>
    <dl className="mt-5 flex gap-7 text-sm tabular-nums">
      <div><dt className="app-meta text-muted-foreground">총점</dt><dd className="mt-1 font-medium" data-ranking-total>{hasScore ? ranking.totalScore.toLocaleString('ko-KR') : '—'}</dd></div>
      <div><dt className="app-meta text-muted-foreground">평균</dt><dd className="mt-1 font-medium" data-ranking-average>{ranking.averageScore === null ? '—' : ranking.averageScore.toFixed(1)}</dd></div>
    </dl>
  </section>;
}
