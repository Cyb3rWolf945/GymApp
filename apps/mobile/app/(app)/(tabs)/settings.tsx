import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signOut } from '../../../src/auth/authService';
import { useAuth } from '../../../src/auth/AuthProvider';
import { authCopy } from '../../../src/auth/copy';
import { en } from '../../../src/copy/en';
import { supabase } from '../../../src/supabase';
import { useTheme } from '../../../src/theme';
import { Button, Card, Text } from '../../../src/ui';

const t = en.home;

export default function SettingsScreen() {
  const { user } = useAuth();
  const { colors, spacing } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ padding: spacing.xl, gap: spacing.xl }}>
        <Text variant="display">{t.settingsTitle}</Text>
        <Card style={{ gap: spacing.sm }}>
          <Text variant="small" tone="muted">{t.account}</Text>
          <Text variant="bodyStrong">{user?.email ?? ''}</Text>
        </Card>
        <Text variant="small" tone="muted">{en.health.disclaimer}</Text>
        <Button label={authCopy.signOut} variant="secondary" onPress={() => void signOut(supabase)} />
      </View>
    </SafeAreaView>
  );
}
