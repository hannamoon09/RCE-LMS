import { useAuth } from '@/auth/AuthContext';
import { useLMS } from '@/data/LMSContext';
import { SectionHeading } from '@/components/shared/Primitives';

export function RankingPreview() {
  const { rankings } = useLMS();
  const { user } = useAuth();
  const ranking = rankings.find(entry => entry.isMe);
  if (!ranking || !user) return null;

  return <section data-ranking-preview aria-label="내 순위" className="min-w-0">
    <SectionHeading title="내 순위" href="/rankings" />
    <p className="app-meta text-muted-foreground">{user.track}</p>
    <div className="mt-3 flex items-baseline gap-2">
      <p className="app-number platinum-number text-3xl" data-ranking-rank>{String(ranking.rank).padStart(2, '0')}<span className="sr-only">위</span></p>
      <p className="app-meta text-muted-foreground">/ {String(rankings.length).padStart(2, '0')}<span className="sr-only">명</span></p>
    </div>
    <p className="app-meta mt-2 text-muted-foreground">{`활성 학생 ${rankings.length}명 기준`}</p>
    <dl className="mt-4 flex gap-5 text-sm tabular-nums">
      <div><dt className="app-meta text-muted-foreground">총점</dt><dd className="mt-1 font-medium" data-ranking-total>{ranking.totalScore.toLocaleString('ko-KR')}</dd></div>
      <div><dt className="app-meta text-muted-foreground">평균</dt><dd className="mt-1 font-medium" data-ranking-average>{ranking.averageScore.toFixed(1)}</dd></div>
    </dl>
  </section>;
}
