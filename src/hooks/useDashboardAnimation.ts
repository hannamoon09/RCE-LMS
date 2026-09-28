import type { RefObject } from 'react';
import { useReveal } from '@/motion/hooks';
// Kept as the compatibility hook for the original dashboard prototypes.
export function useDashboardAnimation(root: RefObject<HTMLElement | null>, variantKey: string) { useReveal(root, variantKey); }
