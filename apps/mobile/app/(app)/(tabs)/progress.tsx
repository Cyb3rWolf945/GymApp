import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { en } from '../../../src/copy/en';
import { useTheme } from '../../../src/theme';
import { EmptyState, Text } from '../../../src/ui';

const t = en.home;

/** Placeholder until workout logging exists: an invitation, not an error. */
export default function ProgressScreen() {
  const { colors, spacing } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ padding: spacing.xl }}>
        <Text variant="display">{t.progressTitle}</Text>
      </View>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <EmptyState title={t.progressEmptyTitle} body={t.progressEmptyBody} />
      </View>
    </SafeAreaView>
  );
}
