import { View } from 'react-native';
import { en } from '../copy/en';
import { useTheme } from '../theme';
import { Text } from '../ui';
import { showOfflineBanner } from './online';
import { useOnline } from './useOnline';

/** Across the top of every screen while the device is offline. Logs keep working: they wait in the queue and sync later. */
export function OfflineBanner() {
  const { colors, spacing } = useTheme();
  if (!showOfflineBanner(useOnline())) return null;
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="polite" role="status" style={{ backgroundColor: colors.surfaceAlt, borderBottomWidth: 1, borderBottomColor: colors.divider, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg }}>
      <Text variant="small" style={{ textAlign: 'center' }}>{en.common.offline}</Text>
    </View>
  );
}
