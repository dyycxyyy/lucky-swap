/**
 * The Lucky Swap brand mark: a single vector four-leaf clover.
 *
 * Concept 1 — Outline Clover: a transparent-background SVG whose leaves are
 * traced with a gold outline. It paints with `currentColor`, so the mark
 * inherits its color from the parent's semantic text token and adapts to
 * light/dark automatically. No raw hex, no baked background.
 *
 * The clover is defined ONLY by its outline: the drawing group is `fill="none"`
 * and the mark is four heart-shaped leaves, each traced as its own closed
 * outline. Nothing is filled, so the interior stays fully transparent at every
 * size.
 */

import { cn } from "@/lib/utils";

export type CloverMarkProps = {
  /** Rendered size in px (square). */
  size?: number;
  className?: string;
  /** Accessible label. Omit for decorative marks (they become aria-hidden). */
  title?: string;
};

/**
 * Four-leaf clover outline on the shared 64x64 grid.
 *
 * Four heart-shaped leaves sit symmetrically on the N/E/S/W axes around the
 * center (32, 32). Each leaf is a closed outline of its own: its rounded lobes
 * face outward and its cleft sits on the outer edge, while the leaf narrows to
 * a point toward the center. The leaves are separate closed subpaths (each ends
 * with `Z`), so the mark reads as four distinct hearts rather than loops tied
 * in a central knot. There is no stem. Each leaf reaches its axis extreme
 * (N ~y=4, E ~x=60, S ~y=60, W ~x=4), so the mark stays balanced and fills the
 * frame at every size.
 */
const CLOVER_PATH =
  // North leaf (lobes up, cleft at top, point at center)
  "M32 32" +
  "C25 25 15 21 15 13" +
  "C15 6 24 3 28 8" +
  "C30 10 31 11 32 13" +
  "C33 11 34 10 36 8" +
  "C40 3 49 6 49 13" +
  "C49 21 39 25 32 32" +
  "Z" +
  // East leaf (lobes right, cleft at right, point at center)
  "M32 32" +
  "C25 39 21 49 13 49" +
  "C6 49 3 40 8 36" +
  "C10 34 11 33 13 32" +
  "C11 31 10 30 8 28" +
  "C3 24 6 15 13 15" +
  "C21 15 25 25 32 32" +
  "Z" +
  // South leaf (lobes down, cleft at bottom, point at center)
  "M32 32" +
  "C39 39 49 43 49 51" +
  "C49 58 40 61 36 56" +
  "C34 54 33 53 32 51" +
  "C31 53 30 54 28 56" +
  "C24 61 15 58 15 51" +
  "C15 43 25 39 32 32" +
  "Z" +
  // West leaf (lobes left, cleft at left, point at center)
  "M32 32" +
  "C39 25 43 15 51 15" +
  "C58 15 61 24 56 28" +
  "C54 30 53 31 51 32" +
  "C53 33 54 34 56 36" +
  "C61 40 58 49 51 49" +
  "C43 49 39 39 32 32" +
  "Z";

/** Outline Clover: transparent background, gold stroke. */
function OutlineClover() {
  return (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      className="mark-vector"
    >
      <path d={CLOVER_PATH} />
    </g>
  );
}

export function CloverMark({ size = 24, className, title }: CloverMarkProps) {
  const decorative = !title;
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative ? true : undefined}
      aria-label={title}
      className={cn("shrink-0", className)}
    >
      {title ? <title>{title}</title> : null}
      <OutlineClover />
    </svg>
  );
}
