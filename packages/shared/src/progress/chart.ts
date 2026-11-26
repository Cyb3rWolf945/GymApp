// Scaling a series into SVG coordinates for the simple line charts (no chart library on mobile).

export interface ChartPoint {
  x: number;
  y: number;
}

/**
 * Maps values onto a box: x evenly by position, y with a little padding around min and max (a flat series sits in
 * the middle). SVG y grows downwards, so higher values get smaller y. Pass `range` to put several series on one
 * y-scale; each series still spreads over the full width on its own.
 */
export function scaleSeries(values: readonly number[], width: number, height: number, pad = 8, range?: { min: number; max: number }): ChartPoint[] {
  if (values.length === 0) return [];
  const min = range?.min ?? Math.min(...values);
  const max = range?.max ?? Math.max(...values);
  const span = max - min;
  const inner = height - pad * 2;
  return values.map((v, i) => ({
    x: values.length === 1 ? width / 2 : (i / (values.length - 1)) * width,
    y: span === 0 ? height / 2 : pad + (1 - (v - min) / span) * inner,
  }));
}

export const toPath = (pts: readonly ChartPoint[]): string => pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

/** The area under a line, closed down to the bottom of the box: the soft fill behind the stroke. Empty for no points. */
export function areaPath(pts: readonly ChartPoint[], height: number): string {
  if (pts.length === 0) return '';
  const last = pts[pts.length - 1];
  return `${toPath(pts)} L ${last.x.toFixed(1)} ${height} L ${pts[0].x.toFixed(1)} ${height} Z`;
}

export interface Bar {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Bars for a series of non-negative values, all starting at the bottom of the box: the tallest fills the height (less
 * `pad` at the top), the rest are in proportion, and any value above zero is at least `minHeight` tall so it stays visible.
 */
export function scaleBars(values: readonly number[], width: number, height: number, gap = 6, pad = 4, minHeight = 3): Bar[] {
  if (values.length === 0) return [];
  const max = Math.max(...values.map((v) => Math.max(0, v)));
  const barWidth = Math.max(2, (width - gap * (values.length - 1)) / values.length);
  const inner = height - pad;
  return values.map((v, i) => {
    const h = max > 0 && v > 0 ? Math.max(minHeight, (v / max) * inner) : 0;
    return { x: i * (barWidth + gap), y: height - h, width: barWidth, height: h };
  });
}

/** The last `n` workout volumes in time order, from rows listed newest first. Workouts with no volume (nothing logged) are left out. */
export function recentVolumes(newestFirst: readonly { volume: number }[], n = 12): number[] {
  return newestFirst
    .filter((r) => r.volume > 0)
    .slice(0, n)
    .map((r) => r.volume)
    .reverse();
}
