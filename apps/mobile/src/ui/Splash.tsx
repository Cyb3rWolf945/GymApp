import { View } from 'react-native';
import { en } from '../copy/en';
import { FadeSlideIn } from '../motion';
import { useTheme } from '../theme';
import { Text } from './Text';

/**
 * What shows while the fonts and the session load: the brand on the theme background, never a blank screen. The first
 * screen then fades in over the same background, so it reads as one cross-fade. Reduced motion: no fade.
 */
export function Splash() {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={en.common.loading} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      <FadeSlideIn>
        <Text variant="display" tone="accent">Fuelift</Text>
      </FadeSlideIn>
    </View>
  );
}
