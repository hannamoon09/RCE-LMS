import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { PanelLeft, LogOut } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { animate } from 'animejs';
import { BrandMark } from '@/components/dashboard/BrandMark';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/profile/UserAvatar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Modal } from '@/components/shared/Modal';
import { navItems } from '@/data/mockData';
import { currentUserId } from '@/data/lmsData';
import { useLMS } from '@/data/LMSContext';
import { useAuth } from '@/auth/AuthContext';
import { cn } from '@/lib/utils';
import { useInteractions, useReducedMotion } from '@/motion/hooks';
import { MOTION } from '@/motion/constants';

type AppShellProps = { children: ReactNode; density?: 'airy' | 'compact' | 'brand' };
export function AppShell({ children, density = 'airy' }: AppShellProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const navigated = useRef(false);
  const { storageError } = useLMS();
  const location = useLocation();
  useInteractions(root);
  useEffect(() => { setOpen(false); }, [location.pathname]);
  useEffect(() => { const query = window.matchMedia('(min-width: 1024px)'); const update = () => { if (query.matches) setOpen(false); }; query.addEventListener('change', update); return () => query.removeEventListener('change', update); }, []);
  return <TooltipProvider><div ref={root} className={cn('app-shell min-h-screen bg-surface-app font-sans text-foreground', density === 'brand' && 'rce-grid')}>
    <a href="#main-content" className="sr-only fixed left-4 top-4 z-50 rounded-md bg-primary p-3 text-primary-foreground focus:not-sr-only">본문으로 바로가기</a>
    <aside data-desktop-sidebar className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-border-subtle bg-surface-sidebar px-4 py-6 lg:block xl:w-72"><SidebarNav /></aside>
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border-subtle bg-surface-sidebar px-5 lg:hidden"><Link to="/dashboard" aria-label="RCE 대시보드"><BrandMark /></Link><Button aria-expanded={open} aria-label="메뉴 열기" size="icon" variant="outline" onClick={() => { navigated.current = false; setOpen(true); }}><PanelLeft size={18} /></Button></header>
    <Modal open={open} onClose={() => setOpen(false)} title="메뉴" drawer onAfterClose={() => { if (navigated.current) document.querySelector<HTMLElement>('main h1')?.focus({ preventScroll: true }); }}><SidebarNav mobile onNavigate={() => { navigated.current = true; setOpen(false); }} /></Modal>
    <main id="main-content" className="app-workspace min-h-[calc(100dvh-4rem)] min-w-0 bg-surface-workspace lg:ml-64 lg:min-h-dvh xl:ml-72"><div className={cn('mx-auto w-full', density === 'compact' ? 'max-w-[1460px]' : 'max-w-7xl')}>{storageError && <p role="alert" className="border-b border-destructive/30 bg-destructive/10 px-8 py-3 text-sm">브라우저 저장 공간을 사용할 수 없습니다. 변경을 저장하지 못했습니다. 저장 공간을 확인한 뒤 다시 시도해 주세요.</p>}{children}</div></main>
  </div></TooltipProvider>;
}
function SidebarNav({ onNavigate, mobile = false }: { onNavigate?: () => void; mobile?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const nav = useRef<HTMLElement>(null);
  const indicator = useRef<HTMLSpanElement>(null);
  const initial = useRef(true);
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const reduce = useReducedMotion();
  const { state } = useLMS();
  const user = state.users.find(u => u.id === currentUserId)!;
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
  return <div ref={root} className={cn('flex h-full min-h-0 flex-col', mobile && 'h-[calc(100dvh-7rem)]')}>
    <Link to="/dashboard" onClick={onNavigate} className="mb-10 block rounded-md"><BrandMark /></Link>
    <p className="mb-3 px-3 app-eyebrow text-muted-foreground">WORKSPACE <span className="ml-2 font-sans text-foreground">{user.track}</span></p>
    <nav ref={nav} aria-label={mobile ? '모바일 메뉴' : '주 메뉴'} className="relative space-y-1">
      <span ref={indicator} aria-hidden="true" data-nav-indicator className="pointer-events-none absolute left-0 top-0 z-10 h-[18px] w-0.5 rounded-full bg-accent" />
      {navItems.filter(item => !item.admin || user.role === 'staff').map(item => { const Icon = item.icon; const href = item.label === 'Dashboard' ? '/dashboard' : item.href; return <NavLink key={item.label} to={href} onClick={onNavigate} className={({ isActive }) => cn('group relative flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-interactive/50 hover:text-foreground', isActive && 'bg-surface-interactive text-foreground', item.admin && 'mt-6 border-t border-border-subtle pt-5')}><Icon className="h-4 w-4 shrink-0 transition-transform motion-safe:group-hover:translate-x-0.5" /><span>{item.label === 'Dashboard' ? '대시보드' : item.label}</span>{item.admin && <span className="ml-auto font-mono text-[10px] text-muted-foreground">ADMIN</span>}</NavLink>; })}
    </nav>
    <div className="mt-auto pt-8"><p className="mb-4 px-3 text-xs text-muted-foreground">데모 · 이 브라우저에 저장</p><div className="flex items-center gap-2 border-t border-border-subtle pt-5"><Link to="/profile" onClick={onNavigate} className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 hover:text-accent"><UserAvatar user={user} /><div className="min-w-0"><p className="truncate text-sm font-medium">{user.name}</p><p className="mt-1 text-xs text-muted-foreground">{user.track} · {user.active ? '활성' : '비활성'}</p></div></Link><Button type="button" variant="ghost" size="icon" className="shrink-0 text-muted-foreground" aria-label="로그아웃" title="로그아웃" onClick={() => { onNavigate?.(); logout(); navigate('/login', { replace: true }); }}><LogOut size={16} /></Button></div></div>
  </div>;
}
