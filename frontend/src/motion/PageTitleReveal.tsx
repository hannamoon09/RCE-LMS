import { useLayoutEffect, useRef, type ComponentPropsWithoutRef } from 'react';
import { animate } from 'animejs';
import { cn } from '@/lib/utils';
import { MOTION } from './constants';
import { useReducedMotion } from './hooks';

type PageTitleRevealProps = Omit<ComponentPropsWithoutRef<'h1'>, 'children' | 'title' | 'aria-label' | 'dangerouslySetInnerHTML'> & {
  title: string;
  documentTitle?: string;
  visualClassName?: string;
};

export function PageTitleReveal({ title, documentTitle = title, visualClassName, className, tabIndex = -1, ...attributes }: PageTitleRevealProps) {
  const root = useRef<HTMLHeadingElement>(null);
  const reduce = useReducedMotion();

  useLayoutEffect(() => { document.title = `${documentTitle} · RCE LMS`; }, [documentTitle]);

  useLayoutEffect(() => {
    const text = root.current?.querySelector<HTMLElement>('[data-title-part]');
    if (!text || reduce) return;
    const animation = animate(text, {
      opacity: [0, 1],
      y: [2, 0],
      duration: 160,
      ease: MOTION.ease,
      onComplete: completed => { completed.revert(); },
    });
    return () => { animation.revert(); };
  }, [title, reduce]);

  return <h1 {...attributes} ref={root} tabIndex={tabIndex} aria-label={title} data-page-title className={cn('break-keep [overflow-wrap:anywhere]', className)}>
    <span aria-hidden="true" data-title-visual data-title-part className={cn('inline-block max-w-full align-baseline', visualClassName)}>{title}</span>
  </h1>;
}
