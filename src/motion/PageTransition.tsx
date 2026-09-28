import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, type Location } from 'react-router-dom';
import { animate } from 'animejs';
import { MOTION } from './constants';
import { useReducedMotion } from './hooks';
export function PageTransition({ children }: { children: (location: Location) => ReactNode }) {
  const location = useLocation();
  const [display, setDisplay] = useState(location);
  const root = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const lastPath = useRef(location.pathname);
  const initial = useRef(true);
  const changing = display.pathname !== location.pathname;
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    let valid = true;
    if (display.key !== location.key) {
      if (reduce || display.pathname === location.pathname) { setDisplay(location); return; }
      const exit = animate(element, { opacity: 0, y: -4, duration: MOTION.exit, ease: MOTION.ease, onComplete: () => { if (valid) setDisplay(location); } });
      return () => { valid = false; exit.cancel(); };
    }
    const pageChanged = lastPath.current !== display.pathname;
    // Also restores an interrupted exit if Back returns to the displayed page.
    const needsEnter = initial.current || pageChanged || !!element.style.opacity;
    initial.current = false;
    let enter: ReturnType<typeof animate> | undefined;
    const clear = () => { element.style.removeProperty('opacity'); element.style.removeProperty('transform'); };
    if (reduce) clear();
    else if (needsEnter) {
      if (pageChanged) { element.style.opacity = '0'; element.style.transform = 'translateY(8px)'; }
      enter = animate(element, { opacity: 1, y: 0, duration: MOTION.enter, ease: MOTION.ease, onComplete: clear });
    }
    if (pageChanged) {
      lastPath.current = display.pathname;
      window.scrollTo({ top: 0, behavior: 'instant' });
      const heading = element.querySelector<HTMLElement>('h1');
      if (heading) heading.focus({ preventScroll: true });
      else {
        const observer = new MutationObserver(() => { const title = element.querySelector<HTMLElement>('h1'); if (title) { title.focus({ preventScroll: true }); observer.disconnect(); } });
        observer.observe(element, { childList: true, subtree: true });
        return () => { enter?.cancel(); observer.disconnect(); };
      }
    }
    return () => { enter?.cancel(); };
  }, [location, display, changing, reduce]);
  return <div ref={root} inert={changing || undefined} data-page-transition>{children(display)}</div>;
}
