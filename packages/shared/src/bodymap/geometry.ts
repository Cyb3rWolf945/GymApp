// Path helpers for the body map. Every shape is a list of points; the curve through them is made of cubic Béziers
// (Catmull-Rom converted), so there is no straight-line polygon anywhere. Written for this app; no third-party artwork.

export type Pt = readonly [number, number];

const f = (n: number): string => String(Math.round(n * 100) / 100);

/** A smooth closed curve through the points. */
export function smoothClosed(pts: readonly Pt[]): string {
  const n = pts.length;
  if (n < 3) return '';
  let d = `M ${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    d += ` C ${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return `${d} Z`;
}

/** A smooth open curve through the points (the thin lines inside a body: abs, quad heads...). */
export function smoothOpen(pts: readonly Pt[]): string {
  const n = pts.length;
  if (n < 2) return '';
  let d = `M ${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(n - 1, i + 2)];
    d += ` C ${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}

export const mirrorPt = (p: Pt, width: number): Pt => [width - p[0], p[1]];
