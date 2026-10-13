import { useLayoutEffect, useRef, type RefObject } from 'react';
import { animate, type JSAnimation } from 'animejs';
import { MOTION } from './constants';
import { useReducedMotion } from './hooks';

type Position = { x: number; y: number };
type Transition = {
  offset: Position;
  animation: JSAnimation;
  restore: () => void;
};

/** Keyed DOM nodes keep their identity; no cloned rows or exit placeholders are needed. */
export function useListTransition(root: RefObject<HTMLDivElement | null>, itemSelector?: string) {
  const reduce = useReducedMotion();
  const previous = useRef<Map<HTMLElement, Position> | null>(null);
  const previousWidth = useRef<number | null>(null);
  const running = useRef(new Map<HTMLElement, Transition>());

  useLayoutEffect(() => {
    const container = root.current;
    if (!container) return;
    const bounds = container.getBoundingClientRect();
    const candidates = itemSelector
      ? Array.from(container.querySelectorAll<HTMLElement>(`${itemSelector}, [data-list-empty]`))
      : Array.from(container.children).filter((node): node is HTMLElement => node instanceof HTMLElement);

    // Read all geometry together. Subtract our current offset to recover layout positions.
    const positions = new Map<HTMLElement, Position>();
    const starts = new Map<HTMLElement, Position>();
    candidates.forEach(node => {
      const rect = node.getBoundingClientRect();
      if (!rect.width || !rect.height) return; // Ignore the inactive responsive table/card view.
      const offset = running.current.get(node)?.offset;
      positions.set(node, { x: rect.left - bounds.left - (offset?.x || 0), y: rect.top - bounds.top - (offset?.y || 0) });
      const old = previous.current?.get(node);
      if (old) starts.set(node, { x: old.x + (offset?.x || 0), y: old.y + (offset?.y || 0) });
    });

    running.current.forEach(transition => { transition.animation.cancel(); transition.restore(); });
    running.current.clear();
    const changedWidth = previousWidth.current !== null && Math.abs(previousWidth.current - bounds.width) > 1;
    const hasPrevious = previous.current !== null;
    previous.current = positions;
    previousWidth.current = bounds.width;
    if (!hasPrevious || reduce || changedWidth) return;

    positions.forEach((position, node) => {
      const start = starts.get(node);
      const entering = !start;
      const offset = { x: start ? start.x - position.x : 0, y: start ? start.y - position.y : 4, opacity: entering ? 0 : 1 };
      if (!entering && Math.abs(offset.x) < 0.5 && Math.abs(offset.y) < 0.5) return;
      const translate = node.style.getPropertyValue('translate');
      const opacity = node.style.getPropertyValue('opacity');
      const restore = () => {
        if (translate) node.style.setProperty('translate', translate); else node.style.removeProperty('translate');
        if (entering) {
          if (opacity) node.style.setProperty('opacity', opacity); else node.style.removeProperty('opacity');
        }
      };
      const draw = () => {
        // Individual translate composes with the existing hover transform.
        node.style.translate = `${offset.x}px ${offset.y}px`;
        if (entering) node.style.opacity = String(offset.opacity);
      };
      draw();
      const animation = animate(offset, {
        x: 0, y: 0, opacity: 1,
        duration: entering ? 180 : 200,
        ease: MOTION.ease,
        onUpdate: draw,
        onComplete: () => {
          if (running.current.get(node)?.animation !== animation) return;
          restore();
          running.current.delete(node);
        },
      });
      running.current.set(node, { offset, animation, restore });
    });
  });

  useLayoutEffect(() => () => {
    running.current.forEach(transition => { transition.animation.cancel(); transition.restore(); });
    running.current.clear();
    previous.current = null;
    previousWidth.current = null;
  }, []);
}
