import { useEffect, useState } from 'react';
import { Platform, Pressable, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../auth/AuthProvider';
import { en } from '../copy/en';
import { useTheme } from '../theme';
import { Button, Text } from '../ui';
import { type TrackingChoice, getTrackingChoice, initPixel, onTrackingChoice, setTrackingChoice } from './tracking';

const t = en.tracking;
/** Below this window height (px) the banner is a compact row. */
const SHORT_SCREEN = 500;

/**
 * Cookie and tracking consent (GDPR), web only. Accept and Reject are equal buttons. Until the visitor accepts,
 * no Pixel script loads and nothing is sent to Meta. The choice is saved with the account at sign-up.
 */
export function TrackingBanner() {
  const { colors, spacing, radius } = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  // A short screen (a phone held sideways, about 390 px high): the banner becomes one compact row so the page keeps room.
  const compact = useWindowDimensions().height < SHORT_SCREEN;
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
  const openPrivacy = () => router.push({ pathname: '/legal/[doc]', params: { doc: 'privacy' } });
  const buttons = (
    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
      <View style={{ flex: 1, minWidth: compact ? 104 : undefined }}><Button label={t.reject} variant="secondary" onPress={() => void setTrackingChoice('rejected')} /></View>
      <View style={{ flex: 1, minWidth: compact ? 104 : undefined }}><Button label={t.accept} variant="secondary" onPress={() => void setTrackingChoice('accepted')} /></View>
    </View>
  );
  return (
    <View style={{ flexShrink: 0, paddingHorizontal: spacing.md, paddingTop: spacing.md, alignItems: 'center' }}>
      <View
        accessibilityRole="alert"
        style={{
          width: '100%', maxWidth: compact ? 960 : 720, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider,
          ...(compact ? { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg } : { gap: spacing.sm, padding: spacing.lg }),
        }}
      >
        {compact ? (
          <>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="bodyStrong">{t.title}</Text>
              <Text variant="caption" tone="muted">{t.body}</Text>
              <Pressable accessibilityRole="link" accessibilityLabel={t.privacy} onPress={openPrivacy} style={{ minHeight: 24, justifyContent: 'center' }}>
                <Text variant="caption" tone="accent">{t.privacy}</Text>
              </Pressable>
            </View>
            <View style={{ width: 230 }}>{buttons}</View>
          </>
        ) : (
          <>
            <Text variant="bodyStrong">{t.title}</Text>
            <Text variant="small" tone="muted">{t.body}</Text>
            <Button label={t.privacy} variant="ghost" onPress={openPrivacy} />
            {buttons}
          </>
        )}
      </View>
    </View>
  );
}
