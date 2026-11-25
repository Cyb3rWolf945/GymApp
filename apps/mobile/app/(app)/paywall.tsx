import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { en } from '../../src/copy/en';
import { useTheme } from '../../src/theme';
import { Button, Text } from '../../src/ui';

/** Placeholder until the paywall (E-18). Access is enforced server-side, never by this screen. */
export default function Paywall() {
  const router = useRouter();
  const { colors, spacing } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, padding: spacing.xl, gap: spacing.md, justifyContent: 'center' }}>
        <Text variant="display">{en.paywall.title}</Text>
        <Text tone="muted">{en.paywall.body}</Text>
      </View>
      <View style={{ padding: spacing.xl }}>
        <Button label={en.common.continue} variant="secondary" onPress={() => router.replace('/')} />
      </View>
    </SafeAreaView>
  );
}
