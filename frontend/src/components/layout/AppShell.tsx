import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { PanelLeft, LogOut } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { animate } from 'animejs';
import { BrandMark } from '@/components/dashboard/BrandMark';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/profile/UserAvatar';
import { Modal } from '@/components/shared/Modal';
import { ErrorState, LoadingState } from '@/components/shared/Primitives';
import { navItems } from '@/data/uiData';
import { useLMS } from '@/data/LMSContext';
import { useAuth } from '@/auth/AuthContext';
import { cn } from '@/lib/utils';
import { useInteractions, useReducedMotion } from '@/motion/hooks';
import { MOTION } from '@/motion/constants';

type AppShellProps = { children: ReactNode };
export function AppShell({ children }: AppShellProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const navigated = useRef(false);
  const { assignmentsLoading, assignmentsError, reloadAssignments, submissionsLoading, submissionsError, reloadSubmissions, membersLoading, membersError, reloadMembers, noticesLoading, noticesError, reloadNotices, rankingsLoading, rankingsReady, rankingsError, reloadRankings } = useLMS();
  const location = useLocation();
  useInteractions(root);
  useEffect(() => { setOpen(false); }, [location.pathname]);
  useEffect(() => { const query = window.matchMedia('(min-width: 1024px)'); const update = () => { if (query.matches) setOpen(false); }; query.addEventListener('change', update); return () => query.removeEventListener('change', update); }, []);
  return <div ref={root} className="app-shell min-h-screen bg-surface-app font-sans text-foreground">
    <a href="#main-content" className="sr-only fixed left-4 top-4 z-50 rounded-md bg-primary p-3 text-primary-foreground focus:not-sr-only">본문으로 바로가기</a>
    <aside data-desktop-sidebar className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-border-subtle bg-surface-sidebar px-4 py-6 lg:block xl:w-72"><SidebarNav /></aside>
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border-subtle bg-surface-sidebar px-5 lg:hidden"><Link to="/dashboard" aria-label="RCE 대시보드"><BrandMark /></Link><Button aria-expanded={open} aria-label="메뉴 열기" size="icon" variant="outline" onClick={() => { navigated.current = false; setOpen(true); }}><PanelLeft size={18} /></Button></header>
    <Modal open={open} onClose={() => setOpen(false)} title="메뉴" drawer onAfterClose={() => { if (navigated.current) document.querySelector<HTMLElement>('main h1')?.focus({ preventScroll: true }); }}><SidebarNav mobile onNavigate={() => { navigated.current = true; setOpen(false); }} /></Modal>
    <main id="main-content" className="app-workspace min-h-[calc(100dvh-4rem)] min-w-0 bg-surface-workspace lg:ml-64 lg:min-h-dvh xl:ml-72"><div className="mx-auto w-full max-w-7xl">{rankingsReady && rankingsError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border-b border-destructive/30 bg-destructive/10 px-8 py-3 text-sm"><p>순위를 갱신하지 못했습니다. {rankingsError}</p><Button variant="outline" size="sm" onClick={reloadRankings}>순위 다시 불러오기</Button></div>}{assignmentsLoading || submissionsLoading || membersLoading || noticesLoading || rankingsLoading ? <LoadingState /> : assignmentsError ? <ErrorState title="과제를 불러오지 못했습니다" description={assignmentsError} onRetry={reloadAssignments} /> : submissionsError ? <ErrorState title="제출물을 불러오지 못했습니다" description={submissionsError} onRetry={reloadSubmissions} /> : membersError ? <ErrorState title="학생 정보를 불러오지 못했습니다" description={membersError} onRetry={reloadMembers} /> : noticesError ? <ErrorState title="공지를 불러오지 못했습니다" description={noticesError} onRetry={reloadNotices} /> : !rankingsReady && rankingsError ? <ErrorState title="순위를 불러오지 못했습니다" description={rankingsError} onRetry={reloadRankings} /> : children}</div></main>
  </div>;
}
function SidebarNav({ onNavigate, mobile = false }: { onNavigate?: () => void; mobile?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const nav = useRef<HTMLElement>(null);
  const indicator = useRef<HTMLSpanElement>(null);
  const initial = useRef(true);
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const reduce = useReducedMotion();
  useLayoutEffect(() => {
    const menu = nav.current;
    const active = menu?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!menu || !indicator.current) return;
    if (!active) { indicator.current.style.opacity = '0'; return; }
    let animation: ReturnType<typeof animate> | undefined;
    const update = () => {
      if (!menu.offsetHeight || !indicator.current) return;
      const y = active.offsetTop + (active.offsetHeight - 18) / 2;
      animation?.cancel();
      animation = animate(indicator.current, { y, opacity: 1, duration: initial.current || reduce ? 0 : MOTION.normal, ease: MOTION.ease });
      initial.current = false;
    };
    const observer = new ResizeObserver(update);
    observer.observe(menu); update();
    return () => { observer.disconnect(); animation?.cancel(); };
  }, [location.pathname, reduce]);
  if (!user) return null;
  const signOut = async () => {
    if (loggingOut) return;
    setLoggingOut(true); setLogoutError('');
    try { await logout(); onNavigate?.(); navigate('/login', { replace: true }); }
    catch (failure) { setLogoutError(failure instanceof Error ? failure.message : '로그아웃하지 못했습니다. 다시 시도해 주세요.'); }
    finally { setLoggingOut(false); }
  };
  return <div ref={root} className={cn('flex h-full min-h-0 flex-col', mobile && 'h-[calc(100dvh-7rem)]')}>
    <Link to="/dashboard" onClick={onNavigate} className="mb-10 block rounded-md"><BrandMark /></Link>
    <p className="mb-3 px-3 app-eyebrow text-muted-foreground">WORKSPACE <span className="ml-2 font-sans text-foreground">{user.track}</span></p>
    <nav ref={nav} aria-label={mobile ? '모바일 메뉴' : '주 메뉴'} className="relative space-y-1">
      <span ref={indicator} aria-hidden="true" data-nav-indicator className="pointer-events-none absolute left-0 top-0 z-10 h-[18px] w-0.5 rounded-full bg-accent" />
      {navItems.filter(item => !item.admin || user.role === 'staff').map(item => { const Icon = item.icon; const href = item.label === 'Dashboard' ? '/dashboard' : item.href; return <NavLink key={item.label} to={href} onClick={onNavigate} className={({ isActive }) => cn('group relative flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-interactive/50 hover:text-foreground', isActive && 'bg-surface-interactive text-foreground', item.admin && 'mt-6 border-t border-border-subtle pt-5')}><Icon className="h-4 w-4 shrink-0 transition-transform motion-safe:group-hover:translate-x-0.5" /><span>{item.label === 'Dashboard' ? '대시보드' : item.label}</span>{item.admin && <span className="ml-auto font-mono text-[10px] text-muted-foreground">ADMIN</span>}</NavLink>; })}
    </nav>
    <div className="mt-auto pt-8">{logoutError && <p role="alert" className="mb-4 px-3 text-xs text-destructive">{logoutError}</p>}<div className="flex items-center gap-2 border-t border-border-subtle pt-5"><Link to="/profile" onClick={onNavigate} className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 hover:text-accent"><UserAvatar user={user} /><div className="min-w-0"><p className="truncate text-sm font-medium">{user.name}</p><p className="mt-1 text-xs text-muted-foreground">{user.track} · {user.active ? '활성' : '비활성'}</p></div></Link><Button type="button" variant="ghost" size="icon" className="shrink-0 text-muted-foreground" aria-label="로그아웃" title="로그아웃" disabled={loggingOut} onClick={() => void signOut()}><LogOut size={16} /></Button></div></div>
  </div>;
}
