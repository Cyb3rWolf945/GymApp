import { useEffect, useId, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useReducedMotion } from '../motion';
import { useTheme } from '../theme';
import { Icon, type IconName } from './Icon';

/** What an empty or error state is about. Each has its own glyph; the frame around it is the same. */
export const ILLUSTRATION_KINDS = ['empty', 'error', 'missing', 'locked', 'workout', 'meals', 'chart', 'list'] as const;
export type IllustrationKind = (typeof ILLUSTRATION_KINDS)[number];

const GLYPHS: Record<IllustrationKind, IconName> = {
  empty: 'leaf',
  error: 'cloud-offline',
  missing: 'search',
  locked: 'lock-closed',
  workout: 'barbell',
  meals: 'restaurant',
  chart: 'bar-chart',
  list: 'basket',
};

const W = 200;
const H = 140;

/**
 * The picture above an empty or error message: a soft glow, a rounded tile with a glyph for the topic and a few
 * floating dots. Decoration only (the message next to it says everything), hidden from screen readers. The tile floats
 * gently; with reduced motion it stays still.
 */
export function Illustration({ kind }: { kind: IllustrationKind }) {
  const { colors, radius, elevation } = useTheme();
  const reduced = useReducedMotion();
  const id = `glow-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const float = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) {
      float.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, float]);
  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
  const tone = kind === 'error' ? colors.danger : colors.accentText;
  return (
    <View testID={`illustration-${kind}`} accessible={false} importantForAccessibility="no-hide-descendants" aria-hidden style={{ width: W, height: H, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute' }}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.accent2} stopOpacity={0.35} />
            <Stop offset="1" stopColor={colors.accent2} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={W} height={H} fill={`url(#${id})`} />
        <Circle cx={28} cy={36} r={4} fill={tone} opacity={0.7} />
        <Circle cx={168} cy={28} r={6} fill={colors.accent2} opacity={0.6} />
        <Circle cx={176} cy={104} r={3} fill={tone} opacity={0.6} />
        <Circle cx={34} cy={108} r={5} fill={colors.accent2} opacity={0.5} />
        <Circle cx={W / 2} cy={H / 2} r={52} fill="none" stroke={colors.divider} strokeWidth={1} opacity={0.7} />
      </Svg>
      <Animated.View style={[{ width: 76, height: 76, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, alignItems: 'center', justifyContent: 'center', transform: [{ translateY }] }, elevation.mid]}>
        <Icon name={GLYPHS[kind]} size={38} color={tone} />
      </Animated.View>
    </View>
  );
}
