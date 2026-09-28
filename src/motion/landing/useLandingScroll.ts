import { useLayoutEffect, type RefObject } from 'react';
import { animate, createScope, createTimeline, svg, type JSAnimation, type Timeline } from 'animejs';
import { MOTION } from '@/motion/constants';
import { useReducedMotion } from '@/motion/hooks';
import { clamp01, rememberDrawing, rememberStyles } from './dom';

type ScrollScene = { element: HTMLElement; animation: Timeline | JSAnimation; kind: 'preview' | 'workflow'; top: number; height: number };

export function useLandingScroll(root: RefObject<HTMLElement | null>) {
  const reduce = useReducedMotion();
  useLayoutEffect(() => {
    const element = root.current;
    if (!element || reduce) return;
    let disposed = false;
    let frame = 0;
    let needsMeasure = true;
    let viewportHeight = window.innerHeight;
    const scope = createScope({ root: element });
    const scenes: ScrollScene[] = [];
    const restores: (() => void)[] = [];
    const feedback = new Map<Element, JSAnimation>();
    const rowCleanup: (() => void)[] = [];

    scope.execute(() => {
      element.querySelectorAll<HTMLElement>('[data-product-preview]').forEach(preview => {
        scenes.push({ element: preview, kind: 'preview', top: 0, height: 0, animation: animate(preview, { scale: [0.96, 1], opacity: [0.6, 1], duration: 1000, ease: 'linear', autoplay: false }) });
      });
      element.querySelectorAll<HTMLElement>('[data-workflow]').forEach(workflow => {
        const timeline = createTimeline({ autoplay: false, defaults: { ease: 'linear' } });
        const stages = Array.from(workflow.querySelectorAll<HTMLElement>('[data-workflow-stage]')).slice(0, 4);
        const line = workflow.querySelector<SVGPathElement>('[data-workflow-line]');
        if (line) {
          restores.push(rememberDrawing(line));
          timeline.add(svg.createDrawable(line), { draw: ['0 0', '0 1'], duration: 900 }, 0);
        }
        stages.forEach((stage, index) => {
          const marker = stage.querySelector<HTMLElement>('.workflow-stage-index > span');
          timeline.add(stage, { y: [8, 0], duration: 220, ease: MOTION.ease }, index * 210);
          if (marker) {
            restores.push(rememberStyles(marker, ['opacity', 'border-color', 'color']));
            const markerStyle = getComputedStyle(marker);
            const foreground = getComputedStyle(element).color;
            const accent = line ? getComputedStyle(line).stroke : foreground;
            marker.style.opacity = '0.6';
            timeline.add(marker, { opacity: [0.6, 1], borderColor: [markerStyle.borderTopColor, accent], color: [markerStyle.color, foreground], duration: 220 }, index * 210);
          }
        });
        if (stages.length || line) scenes.push({ element: workflow, kind: 'workflow', top: 0, height: 0, animation: timeline });
      });
    });

    const revealObserver = new IntersectionObserver(entries => {
      if (disposed) return;
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        revealObserver.unobserve(entry.target);
        scope.execute(() => animate(entry.target, { opacity: [0.55, 1], y: [8, 0], duration: MOTION.slow, ease: MOTION.ease }));
      });
    }, { threshold: 0.18 });
    element.querySelectorAll('[data-section-intro], [data-final-cta]').forEach(target => revealObserver.observe(target));

    const update = () => {
      frame = 0;
      if (disposed || document.hidden) return;
      const scroll = window.scrollY;
      if (needsMeasure) {
        viewportHeight = window.innerHeight;
        scenes.forEach(scene => {
          const rect = scene.element.getBoundingClientRect();
          scene.top = rect.top + scroll;
          scene.height = rect.height;
        });
        needsMeasure = false;
      }
      scenes.forEach(scene => {
        const distance = scene.kind === 'preview' ? viewportHeight * 0.65 : Math.max(viewportHeight * 0.55, scene.height + viewportHeight * 0.5);
        const progress = clamp01((scroll + viewportHeight * 0.88 - scene.top) / distance);
        scene.animation.seek(progress * scene.animation.duration, true);
      });
    };
    const schedule = () => { if (!frame && !document.hidden) frame = requestAnimationFrame(update); };
    const measure = () => { needsMeasure = true; schedule(); };
    const visibility = () => { if (document.hidden && frame) { cancelAnimationFrame(frame); frame = 0; } else measure(); };
    const resize = new ResizeObserver(measure);
    resize.observe(element);
    scenes.forEach(scene => resize.observe(scene.element));
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', measure, { passive: true });
    document.addEventListener('visibilitychange', visibility);

    element.querySelectorAll<HTMLElement>('[data-area-row]').forEach(row => {
      const icon = row.querySelector<HTMLElement | SVGElement>('[data-area-icon]');
      const line = row.querySelector<HTMLElement | SVGElement>('[data-area-line]');
      if (icon) restores.push(rememberStyles(icon, ['transform']));
      if (line) restores.push(rememberStyles(line, ['opacity', 'transform']));
      const respond = (active: boolean) => {
        const run = (target: HTMLElement | SVGElement, parameters: Parameters<typeof animate>[1]) => {
          feedback.get(target)?.cancel();
          feedback.set(target, animate(target, { ...parameters, duration: MOTION.fast, ease: MOTION.ease, onComplete: () => { feedback.delete(target); } }));
        };
        if (icon) run(icon, { x: active ? 2 : 0 });
        if (line) run(line, { scaleX: active ? [0.25, 1] : 0.25, opacity: active ? 1 : 0 });
      };
      const enter = (event: PointerEvent) => { if (event.pointerType !== 'touch') respond(true); };
      const leave = () => { if (!row.contains(document.activeElement)) respond(false); };
      const focus = () => respond(true);
      const blur = (event: FocusEvent) => { if (!(event.relatedTarget instanceof Node) || !row.contains(event.relatedTarget)) respond(false); };
      row.addEventListener('pointerenter', enter);
      row.addEventListener('pointerleave', leave);
      row.addEventListener('focusin', focus);
      row.addEventListener('focusout', blur);
      rowCleanup.push(() => {
        row.removeEventListener('pointerenter', enter);
        row.removeEventListener('pointerleave', leave);
        row.removeEventListener('focusin', focus);
        row.removeEventListener('focusout', blur);
      });
    });
    // Establish the scroll position before paint, including restored/history scroll.
    update();
    return () => {
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', measure);
      document.removeEventListener('visibilitychange', visibility);
      resize.disconnect();
      revealObserver.disconnect();
      rowCleanup.forEach(remove => remove());
      feedback.forEach(animation => animation.cancel());
      feedback.clear();
      scope.revert();
      restores.reverse().forEach(restore => restore());
    };
  }, [root, reduce]);
}
