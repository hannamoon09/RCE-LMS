import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';
import { animate, type JSAnimation } from 'animejs';
import { MOTION, reducedMotionQuery } from './constants';
export function useReducedMotion() {
  const [reduce, setReduce] = useState(() => window.matchMedia(reducedMotionQuery).matches);
  useEffect(() => { const query = window.matchMedia(reducedMotionQuery); const update = () => setReduce(query.matches); query.addEventListener('change', update); update(); return () => query.removeEventListener('change', update); }, []);
  return reduce;
}
export function useChangeFade(root: RefObject<HTMLElement | null>, key: string) {
  const reduce = useReducedMotion();
  useLayoutEffect(() => { if (!root.current || reduce) return; const animation = animate(root.current, { opacity: [0.35, 1], duration: MOTION.fast, ease: MOTION.ease }); return () => { animation.revert(); }; }, [root, key, reduce]);
}
export function useInteractions(root: RefObject<HTMLElement | null>) {
  const reduce = useReducedMotion();
  useEffect(() => {
    const element = root.current;
    if (!element || reduce) return;
    const animations = new Map<HTMLElement, JSAnimation>();
    const move = (event: PointerEvent, over: boolean) => {
      if (event.pointerType === 'touch' || !(event.target instanceof Element)) return;
      const target = event.target.closest<HTMLElement>('[data-interactive]');
      if (!target || !element.contains(target) || (event.relatedTarget instanceof Node && target.contains(event.relatedTarget))) return;
      animations.get(target)?.cancel();
      animations.set(target, animate(target, { y: over ? -1 : 0, duration: MOTION.fast, ease: MOTION.ease, onComplete: () => { animations.delete(target); } }));
    };
    const enter = (event: PointerEvent) => move(event, true);
    const leave = (event: PointerEvent) => move(event, false);
    element.addEventListener('pointerover', enter); element.addEventListener('pointerout', leave);
    return () => { element.removeEventListener('pointerover', enter); element.removeEventListener('pointerout', leave); animations.forEach(a => a.cancel()); animations.clear(); element.querySelectorAll<HTMLElement>('[data-interactive]').forEach(target => target.style.removeProperty('transform')); };
  }, [root, reduce]);
}
