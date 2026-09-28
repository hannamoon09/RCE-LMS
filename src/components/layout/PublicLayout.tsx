import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { BrandMark } from '@/components/dashboard/BrandMark';
import { cn } from '@/lib/utils';
import '@/styles/landing.css';

export function PublicLayout({ children, mode = 'landing' }: { children: ReactNode; mode?: 'landing' | 'login' }) {
  const { isAuthenticated } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const previousPath = useRef(location.pathname);
  useEffect(() => {
    let frame = 0;
    const update = () => { frame = 0; setScrolled(window.scrollY > 24); };
    const scroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    window.addEventListener('scroll', scroll, { passive: true }); update();
    return () => { window.removeEventListener('scroll', scroll); cancelAnimationFrame(frame); };
  }, []);
  useEffect(() => {
    if (previousPath.current === location.pathname) return;
    previousPath.current = location.pathname;
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.querySelector<HTMLElement>('#public-main h1')?.focus({ preventScroll: true });
  }, [location.pathname]);
  const cta = isAuthenticated ? '대시보드로 이동' : '로그인';
  return <div className={cn('public-layout', mode === 'login' && 'public-layout-login')}>
    <a href="#public-main" className="public-skip-link">본문으로 바로가기</a>
    <header className={cn('public-header', scrolled && 'is-scrolled')}>
      <div className="public-header-inner">
        <Link to="/" aria-label="RCE 홈" className="public-brand"><BrandMark /></Link>
        <nav aria-label="공개 페이지 메뉴" className="public-nav">
          {mode === 'landing' && <><a className="public-nav-section" href="#about">About</a><a className="public-nav-section" href="#lms">LMS</a></>}
          {mode === 'login' ? <Link to="/" className="public-home-link">RCE 홈으로</Link> : <Link to={isAuthenticated ? '/dashboard' : '/login'} className="public-nav-cta">{cta}<ArrowUpRight size={15} /></Link>}
        </nav>
      </div>
    </header>
    <main id="public-main" tabIndex={-1}>{children}</main>
    <footer className="public-footer"><Link to="/" className="font-semibold tracking-[0.12em]">RCE</Link><span>Information Security Club</span><span className="public-footer-label">RCE LMS</span></footer>
  </div>;
}
