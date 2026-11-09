"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * Track an element's content width so SVG charts draw at true pixel size. The
 * first measurement happens before paint, so a chart never renders wider than
 * its container, even for a frame.
 */
export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = (w: number) => setWidth(Math.max(240, Math.floor(w)));
    measure(el.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => {
      if (entry) measure(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}
