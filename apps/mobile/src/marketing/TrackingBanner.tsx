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

  // Only for signed-out visitors (the ad funnel). Signed-in users never see it. It sits at the top so it can't cover
  // the Continue and action buttons at the bottom of every screen.
  if (Platform.OS !== 'web' || choice !== null || session) return null;
  return (
    <View
      accessibilityRole="alert"
      style={{
        position: 'absolute', left: spacing.md, right: spacing.md, top: spacing.md, gap: spacing.sm, padding: spacing.lg,
        borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, zIndex: 100,
      }}
    >
      <Text variant="bodyStrong">{t.title}</Text>
      <Text variant="small" tone="muted">{t.body}</Text>
      <Button label={t.privacy} variant="ghost" onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'privacy' } })} />
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1 }}><Button label={t.reject} variant="secondary" onPress={() => void setTrackingChoice('rejected')} /></View>
        <View style={{ flex: 1 }}><Button label={t.accept} variant="secondary" onPress={() => void setTrackingChoice('accepted')} /></View>
      </View>
    </View>
  );
}
