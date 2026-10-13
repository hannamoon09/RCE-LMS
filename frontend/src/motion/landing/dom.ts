import { useEffect, useState } from 'react';

export const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    media.addEventListener('change', update);
    update();
    return () => media.removeEventListener('change', update);
  }, [query]);
  return matches;
}

export function rememberStyles(element: HTMLElement | SVGElement, properties: string[]) {
  const values = properties.map(property => [property, element.style.getPropertyValue(property), element.style.getPropertyPriority(property)]);
  return () => values.forEach(([property, value, priority]) => {
    if (value) element.style.setProperty(property, value, priority);
    else element.style.removeProperty(property);
  });
}

// createDrawable modifies attributes in addition to the animation's own styles.
export function rememberDrawing(path: SVGGeometryElement) {
  const names = ['pathLength', 'draw', 'stroke-dasharray', 'stroke-dashoffset'];
  const values = names.map(name => [name, path.getAttribute(name)] as const);
  const restoreStyle = rememberStyles(path, ['stroke-linecap']);
  return () => {
    values.forEach(([name, value]) => {
      if (value === null) path.removeAttribute(name);
      else path.setAttribute(name, value);
    });
    restoreStyle();
  };
}
