import { useLayoutEffect, useRef, type RefObject } from 'react';
import { animate, svg, type JSAnimation } from 'animejs';
import { MOTION } from '@/motion/constants';
import { useReducedMotion } from '@/motion/hooks';
import { rememberDrawing, rememberStyles, useMediaQuery } from './dom';

export function useNetworkMotion(root: RefObject<HTMLElement | null>, paused = false) {
  const reduce = useReducedMotion();
  const mobile = useMediaQuery('(max-width: 767px)');
  const finePointer = useMediaQuery('(hover: hover) and (pointer: fine)');
  const pausedRef = useRef(paused);
  const syncRef = useRef<(() => void) | null>(null);
  useLayoutEffect(() => { pausedRef.current = paused; syncRef.current?.(); }, [paused]);

  useLayoutEffect(() => {
    const element = root.current;
    const drawing = element?.querySelector<SVGPathElement>('[data-network-path]')?.ownerSVGElement ?? element?.querySelector<SVGSVGElement>('svg');
    if (!element || !drawing) return;
    const originalState = element.getAttribute('data-network-state');
    const restoreState = () => {
      if (originalState === null) element.removeAttribute('data-network-state');
      else element.setAttribute('data-network-state', originalState);
    };
    if (reduce) {
      element.dataset.networkState = 'reduced';
      return restoreState;
    }
    let disposed = false;
    let inView = false;
    let playing = false;
    let pointerFrame = 0;
    let measureFrame = 0;
    let pointer: { x: number; y: number } | null = null;
    let coordinates = { left: 0, top: 0, scale: 1, width: 640, height: 600 };
    const restore: (() => void)[] = [];
    const loops: JSAnimation[] = [];
    const entrances: JSAnimation[] = [];
    const feedback = new Map<SVGElement, JSAnimation>();
    const selected = new Set<SVGElement>();
    const visible = (node: SVGElement) => !mobile || !node.classList.contains('network-desktop-detail');
    const paths = Array.from(element.querySelectorAll<SVGPathElement>('[data-network-path]')).filter(visible);
    const nodes = Array.from(element.querySelectorAll<SVGGElement>('[data-network-node]')).filter(visible).map(node => {
      restore.push(rememberStyles(node, ['opacity']));
      const opacity = Math.min(0.62, Math.max(0.25, Number.parseFloat(getComputedStyle(node).opacity) || 0.5));
      node.style.opacity = String(opacity);
      return { element: node, x: Number(node.dataset.x), y: Number(node.dataset.y), opacity };
    }).filter(node => Number.isFinite(node.x) && Number.isFinite(node.y));
    const parallax = drawing.querySelector<SVGGElement>('[data-network-parallax]');
    if (parallax) restore.push(rememberStyles(parallax, ['transform']));

    paths.forEach((path, index) => {
      restore.push(rememberDrawing(path));
      const drawable = svg.createDrawable(path, 0, 1);
      entrances.push(animate(drawable, { draw: ['0 0.65', '0 1'], duration: 900, delay: index * 70, ease: MOTION.ease, autoplay: false }));
    });
    const packets = Array.from(element.querySelectorAll<SVGCircleElement>('[data-network-packet]')).filter(visible).slice(0, mobile ? 2 : 4);
    packets.forEach((packet, index) => {
      const path = paths.find(candidate => candidate.id === packet.dataset.path);
      if (!path) return;
      restore.push(rememberStyles(packet, ['transform', 'opacity']));
      packet.style.opacity = '0';
      const { translateX, translateY } = svg.createMotionPath(path);
      const duration = (mobile ? 6200 : 4900) + index * 550;
      loops.push(animate(packet, {
        translateX, translateY,
        opacity: [{ to: 0.8, duration: 360 }, { to: 0.8, duration: duration - 720 }, { to: 0, duration: 360 }],
        duration, delay: index * 850, loop: true, loopDelay: 1500 + index * 300, ease: 'linear', autoplay: false,
      }));
    });

    const transition = (target: SVGElement, parameters: Parameters<typeof animate>[1]) => {
      feedback.get(target)?.cancel();
      feedback.set(target, animate(target, { ...parameters, duration: MOTION.normal, ease: MOTION.ease, onComplete: () => { feedback.delete(target); } }));
    };
    const resetPointer = () => {
      pointer = null;
      if (pointerFrame) cancelAnimationFrame(pointerFrame);
      pointerFrame = 0;
      nodes.forEach(node => {
        feedback.get(node.element)?.cancel();
        node.element.style.opacity = String(node.opacity);
      });
      if (parallax) {
        feedback.get(parallax)?.cancel();
        parallax.style.removeProperty('transform');
      }
      feedback.clear();
      selected.clear();
    };
    const sync = () => {
      if (disposed) return;
      playing = inView && !document.hidden && !pausedRef.current;
      element.dataset.networkState = document.hidden ? 'hidden' : pausedRef.current ? 'paused' : !inView ? 'offscreen' : 'running';
      loops.forEach(animation => { if (playing) animation.resume(); else animation.pause(); });
      entrances.forEach(animation => {
        if (pausedRef.current && !animation.completed) animation.seek(animation.duration, true).pause();
        else if (playing && !animation.completed) animation.resume();
        else animation.pause();
      });
      if (!playing) { resetPointer(); if (measureFrame) cancelAnimationFrame(measureFrame); measureFrame = 0; }
      else requestMeasure();
    };
    syncRef.current = sync;
    const measure = () => {
      measureFrame = 0;
      if (disposed || !playing || !finePointer || mobile) return;
      const rect = drawing.getBoundingClientRect();
      const viewBox = drawing.viewBox.baseVal;
      const width = viewBox.width || 640;
      const height = viewBox.height || 600;
      const scale = Math.max(0.001, Math.min(rect.width / width, rect.height / height));
      coordinates = { left: rect.left + (rect.width - width * scale) / 2, top: rect.top + (rect.height - height * scale) / 2, scale, width, height };
    };
    const requestMeasure = () => { if (!disposed && playing && finePointer && !mobile && !measureFrame) measureFrame = requestAnimationFrame(measure); };
    const reactToPointer = () => {
      pointerFrame = 0;
      if (!pointer || !playing || disposed) return;
      const x = (pointer.x - coordinates.left) / coordinates.scale;
      const y = (pointer.y - coordinates.top) / coordinates.scale;
      const nearest = nodes.map(node => ({ node, distance: (node.x - x) ** 2 + (node.y - y) ** 2 })).sort((a, b) => a.distance - b.distance).slice(0, 3).filter((item, index) => index === 0 || item.distance < 180 ** 2);
      const next = new Set(nearest.map(item => item.node.element));
      nodes.forEach(node => {
        if (next.has(node.element) !== selected.has(node.element)) transition(node.element, { opacity: next.has(node.element) ? 1 : node.opacity });
      });
      selected.clear();
      next.forEach(node => selected.add(node));
      if (parallax) transition(parallax, { x: Math.max(-4, Math.min(4, (x / coordinates.width - 0.5) * 8)), y: Math.max(-4, Math.min(4, (y / coordinates.height - 0.5) * 8)) });
    };
    const onPointer = (event: PointerEvent) => {
      if (!finePointer || mobile || !playing || event.pointerType === 'touch') return;
      pointer = { x: event.clientX, y: event.clientY };
      if (!pointerFrame) pointerFrame = requestAnimationFrame(reactToPointer);
    };
    const observer = new IntersectionObserver(entries => {
      if (disposed) return;
      inView = entries.some(entry => entry.isIntersecting);
      sync();
    }, { threshold: 0 });
    observer.observe(element);
    const resize = new ResizeObserver(requestMeasure);
    resize.observe(drawing);
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('resize', requestMeasure, { passive: true });
    window.addEventListener('scroll', requestMeasure, { passive: true });
    element.addEventListener('pointermove', onPointer, { passive: true });
    element.addEventListener('pointerleave', resetPointer);
    measure();
    sync();
    return () => {
      disposed = true;
      syncRef.current = null;
      observer.disconnect();
      resize.disconnect();
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('resize', requestMeasure);
      window.removeEventListener('scroll', requestMeasure);
      element.removeEventListener('pointermove', onPointer);
      element.removeEventListener('pointerleave', resetPointer);
      if (pointerFrame) cancelAnimationFrame(pointerFrame);
      if (measureFrame) cancelAnimationFrame(measureFrame);
      feedback.forEach(animation => animation.cancel());
      loops.forEach(animation => animation.revert());
      entrances.forEach(animation => animation.revert());
      restore.reverse().forEach(reset => reset());
      restoreState();
    };
  }, [root, reduce, mobile, finePointer]);
}
