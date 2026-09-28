import { Link } from 'react-router-dom';
import { useLearningData } from '@/data/useLearningData';

export function FocusPanel({ variant: _variant = 'minimal' }: { variant?: 'minimal' | 'platform' | 'bento' | 'brand' }) {
  const { user, assignments } = useLearningData();
  return <section className="border-t border-border py-5"><p className="app-eyebrow">TRACK</p><h2 className="mt-3 font-display text-xl font-semibold">{user.track}</h2><Link to="/assignments" className="mt-6 flex justify-between gap-3 text-sm hover:text-foreground/75"><span>전체 과제</span><span className="tabular-nums text-muted-foreground">{assignments.length}</span></Link></section>;
}
