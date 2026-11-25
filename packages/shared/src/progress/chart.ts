// Scaling a series into SVG coordinates for the simple line charts (no chart library on mobile).

export interface ChartPoint {
  x: number;
  y: number;
}

/**
 * Maps values onto a box: x evenly by position, y with a little padding around min and max (a flat series sits in
 * the middle). SVG y grows downwards, so higher values get smaller y.
 */
export function scaleSeries(values: readonly number[], width: number, height: number, pad = 8): ChartPoint[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const inner = height - pad * 2;
  return values.map((v, i) => ({
    x: values.length === 1 ? width / 2 : (i / (values.length - 1)) * width,
    y: span === 0 ? height / 2 : pad + (1 - (v - min) / span) * inner,
  }));
}

export const toPath = (pts: readonly ChartPoint[]): string => pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
