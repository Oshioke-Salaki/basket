import type { SVGProps } from "react";

/** A small, consistent glyph set: 20px box, 1.6px strokes, currentColor. */
function Glyph({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {children}
    </svg>
  );
}

export const ArrowUp = (p: SVGProps<SVGSVGElement>) => (
  <Glyph {...p}>
    <path d="M10 15V5M5.5 9.5 10 5l4.5 4.5" />
  </Glyph>
);
export const ArrowDown = (p: SVGProps<SVGSVGElement>) => (
  <Glyph {...p}>
    <path d="M10 5v10M5.5 10.5 10 15l4.5-4.5" />
  </Glyph>
);
export const Shrink = (p: SVGProps<SVGSVGElement>) => (
  <Glyph {...p}>
    <path d="M4 4l4 4M8 4.5V8H4.5M16 16l-4-4M12 15.5V12h3.5" />
  </Glyph>
);
export const Store = (p: SVGProps<SVGSVGElement>) => (
  <Glyph {...p}>
    <path d="M3.5 8.5V16h13V8.5M2.5 8.5 4 4h12l1.5 4.5M8 16v-4h4v4" />
  </Glyph>
);
export const Sparkle = (p: SVGProps<SVGSVGElement>) => (
  <Glyph {...p}>
    <path d="M10 3v4M10 13v4M3 10h4M13 10h4M5.5 5.5l2 2M12.5 12.5l2 2M14.5 5.5l-2 2M7.5 12.5l-2 2" />
  </Glyph>
);
export const Check = (p: SVGProps<SVGSVGElement>) => (
  <Glyph {...p}>
    <path d="m4.5 10.5 3.5 3.5 7.5-8" />
  </Glyph>
);
export const Camera = (p: SVGProps<SVGSVGElement>) => (
  <Glyph {...p}>
    <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h2l1.5-2h4l1.5 2h2A1.5 1.5 0 0 1 17 7.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 14.5z" />
    <circle cx="10" cy="11" r="3" />
  </Glyph>
);
export const Equal = (p: SVGProps<SVGSVGElement>) => (
  <Glyph {...p}>
    <path d="M5 8h10M5 12h10" />
  </Glyph>
);
export const Copy = (p: SVGProps<SVGSVGElement>) => (
  <Glyph {...p}>
    <rect x="7" y="7" width="9" height="9" rx="2" />
    <path d="M4 13V5.5A1.5 1.5 0 0 1 5.5 4H13" />
  </Glyph>
);
export const External = (p: SVGProps<SVGSVGElement>) => (
  <Glyph {...p}>
    <path d="M11 4h5v5M16 4l-7 7M14 12v3.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5H8" />
  </Glyph>
);

/** The Basket mark: three stacked bars, the dealt "stack" mark. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} className={className} aria-hidden="true">
      <g fill="currentColor">
        <rect x="3" y="14" width="18" height="6" rx="2" />
        <rect x="5" y="8" width="14" height="4.5" rx="2" opacity=".75" />
        <rect x="7" y="3" width="10" height="3.5" rx="1.75" opacity=".5" />
      </g>
    </svg>
  );
}
