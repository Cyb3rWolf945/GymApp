import { Children, useState, type ReactNode } from 'react';
import { type LayoutChangeEvent, View } from 'react-native';
import { type GridColumns, cellWidth, columnsFor, useBreakpoint, useTheme } from '../theme';

interface Props {
  children: ReactNode;
  /** Override the default 1 / 2 / 3 columns for compact / medium / expanded. */
  columns?: Partial<GridColumns>;
  /** Space between cells (px). Defaults to `spacing.lg`. */
  gap?: number;
}

/**
 * Lays children out in columns: 1 on `compact`, 2 on `medium`, 3 on `expanded` by default. Cell widths come from the
 * measured container (`cellWidth`), so it works the same on web and native and follows window resizes.
 */
export function ResponsiveGrid({ children, columns, gap }: Props) {
  const { spacing } = useTheme();
  const bp = useBreakpoint();
  const g = gap ?? spacing.lg;
  const cols = columnsFor(bp, columns);
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  // Before the first measurement every cell is full width; one column never needs a measurement.
  const cell = cols === 1 || width === 0 ? '100%' : cellWidth(width, cols, g);
  return (
    <View onLayout={onLayout} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: g }}>
      {Children.toArray(children).map((child, i) => (
        <View key={i} style={{ width: cell }}>{child}</View>
      ))}
    </View>
  );
}
