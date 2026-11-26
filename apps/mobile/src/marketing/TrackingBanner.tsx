import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../auth/AuthProvider';
import { en } from '../copy/en';
import { useTheme } from '../theme';
import { Button, Text } from '../ui';
import { type TrackingChoice, getTrackingChoice, initPixel, onTrackingChoice, setTrackingChoice } from './tracking';

const t = en.tracking;

/**
 * Cookie and tracking consent (GDPR), web only. Accept and Reject are equal buttons. Until the visitor accepts,
 * no Pixel script loads and nothing is sent to Meta. The choice is saved with the account at sign-up.
 */
export function TrackingBanner() {
  const { colors, spacing, radius } = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  const [choice, setChoice] = useState<TrackingChoice | null | undefined>(undefined);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    void getTrackingChoice().then((c) => {
      setChoice(c);
      if (c === 'accepted') initPixel(); // a returning visitor who accepted before
    });
    return onTrackingChoice(setChoice);
  }, []);

  // Only for signed-out visitors (the ad funnel). Signed-in users never see it. It is part of the page flow, above the
  // screen: the content starts below it (and scrolls), so it never hides a title, a question or the action buttons.
  if (Platform.OS !== 'web' || choice !== null || session) return null;
  return (
    <View style={{ flexShrink: 0, paddingHorizontal: spacing.md, paddingTop: spacing.md, alignItems: 'center' }}>
      <View
        accessibilityRole="alert"
        style={{ width: '100%', maxWidth: 720, gap: spacing.sm, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider }}
      >
        <Text variant="bodyStrong">{t.title}</Text>
        <Text variant="small" tone="muted">{t.body}</Text>
        <Button label={t.privacy} variant="ghost" onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'privacy' } })} />
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1 }}><Button label={t.reject} variant="secondary" onPress={() => void setTrackingChoice('rejected')} /></View>
          <View style={{ flex: 1 }}><Button label={t.accept} variant="secondary" onPress={() => void setTrackingChoice('accepted')} /></View>
        </View>
      </View>
    </View>
  );
}
