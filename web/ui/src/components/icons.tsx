import type { SVGProps } from "react";

// Direction arrows drawn as icons.
//
// The "→" and "←" glyphs are fonts' business, not ours: their weight, length and
// vertical position change from one platform to the next, and on a link that
// pairs them with text they read as an afterthought. An SVG holds the same shape
// and alignment everywhere, and takes currentColor so it inherits the link's
// hover colour for free.

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function ArrowRight({
  className = "h-4 w-4",
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} className={className} {...props}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

export function ArrowLeft({
  className = "w-4 h-4",
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} className={className} {...props}>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}
