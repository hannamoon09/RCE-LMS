import { useLayoutEffect, type RefObject } from 'react';
import { createScope, createTimeline, stagger, type AnimationParams } from 'animejs';
import { MOTION } from '@/motion/constants';
import { useReducedMotion } from '@/motion/hooks';

export function useHeroMotion(root: RefObject<HTMLElement | null>) {
  const reduce = useReducedMotion();
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const boot = element.querySelector<HTMLElement>('[data-boot-label]');
    const originalLabel = boot?.textContent ?? '';
    const ready = () => { if (boot) boot.textContent = 'INTERFACE READY'; };
    if (reduce) {
      ready();
      return () => { if (boot) boot.textContent = originalLabel; };
    }

    let valid = true;
    const scope = createScope({ root: element });
    const timeline = scope.execute(() => {
      const sequence = createTimeline({ autoplay: false, defaults: { ease: MOTION.ease }, onComplete: () => { if (valid) ready(); } });
      const add = (selector: string, parameters: AnimationParams, position: number) => {
        const targets = element.querySelectorAll(selector);
        if (targets.length) sequence.add(targets, parameters, position);
      };
      add('[data-hero-ambient]', { opacity: [0.4, 1], duration: 720 }, 0);
      add('[data-hero-logo]', { clipPath: ['inset(0 86% 0 0)', 'inset(0 0% 0 0)'], opacity: [0.35, 1], duration: MOTION.slow }, 40);
      add('[data-brand-glyph]', { clipPath: ['inset(0 0 24% 0)', 'inset(0 0 0% 0)'], opacity: [0.5, 1], y: [14, 0], duration: 620, delay: stagger(70) }, 130);
      add('[data-brand-rule]', { scaleX: [0.1, 1], opacity: [0.35, 1], duration: 560 }, 310);
      add('[data-hero-label]', { opacity: [0.5, 1], y: [5, 0], duration: MOTION.normal }, 120);
      add('[data-hero-line]', { opacity: [0.4, 1], y: [12, 0], duration: 520, delay: stagger(95) }, 180);
      add('[data-hero-copy]', { opacity: [0.55, 1], y: [6, 0], duration: MOTION.slow }, 430);
      // The CTA never disappears or becomes inert during the introduction.
      add('[data-hero-cta]', { opacity: [0.78, 1], duration: MOTION.normal }, 510);
      sequence.call(ready, 1020);
      sequence.play();
      return sequence;
    });
    const finishOnFocus = (event: FocusEvent) => {
      if (event.target instanceof Element && event.target.closest('[data-hero-cta]')) timeline.complete();
    };
    element.addEventListener('focusin', finishOnFocus);
    return () => {
      valid = false;
      element.removeEventListener('focusin', finishOnFocus);
      scope.revert();
      if (boot) boot.textContent = originalLabel;
    };
  }, [root, reduce]);
}
