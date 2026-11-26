import { useId } from 'react';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { brandAssets } from '../theme/tokens';

/**
 * The Fuelift mark: the same gradient tile, "F" and violet spark as the app icon (apps/mobile/assets/src/icon.svg). The
 * colours are the brand's, fixed on purpose (a logo does not change with the theme). Decoration: the name is next to it.
 */
export function BrandMark({ size = 72 }: { size?: number }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <Svg width={size} height={size} viewBox="212 212 600 600" aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        <LinearGradient id={`brand-${id}`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={brandAssets.mark.lime} />
          <Stop offset="1" stopColor={brandAssets.mark.mint} />
        </LinearGradient>
        <LinearGradient id={`shine-${id}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={brandAssets.mark.white} stopOpacity={0.34} />
          <Stop offset="0.55" stopColor={brandAssets.mark.white} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect x={212} y={212} width={600} height={600} rx={150} fill={`url(#brand-${id})`} />
      <Rect x={212} y={212} width={600} height={600} rx={150} fill={`url(#shine-${id})`} />
      <Path d="M384 318 H668 V402 H476 V470 H636 V552 H476 V706 H384 Z" fill={brandAssets.mark.ink} stroke={brandAssets.mark.ink} strokeWidth={20} strokeLinejoin="round" />
      <Circle cx={650} cy={652} r={46} fill={brandAssets.mark.violet} />
    </Svg>
  );
}
