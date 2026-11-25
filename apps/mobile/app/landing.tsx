import { useEffect } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { utmProps } from '@gymapp/shared';
import { trackEvent } from '../src/analytics/track';
import { en } from '../src/copy/en';
import { captureAttribution } from '../src/marketing/tracking';
import { useTheme } from '../src/theme';
import { Button, Card, Text } from '../src/ui';

const t = en.landing;
// The router can mount this screen twice on a first visit (anchor route plus the resolved one): count the visit once.
let visitCounted = false;

/** Web landing page for ads and search. Signed-out visitors on iOS and Android go straight to the quiz. */
export default function Landing() {
  const router = useRouter();
  const { colors, spacing } = useTheme();

  useEffect(() => {
    if (Platform.OS !== 'web' || visitCounted) return;
    visitCounted = true;
    // Keep the UTM tags (first touch) and count the visit with them.
    void captureAttribution().then((a) => trackEvent('landing_view', utmProps(a)));
  }, []);

  if (Platform.OS !== 'web') return <Redirect href="/onboarding" />;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl, flexGrow: 1, justifyContent: 'center', maxWidth: 720, alignSelf: 'center', width: '100%' }}>
        <View style={{ gap: spacing.md }}>
          <Text variant="display" accessibilityRole="header">{t.hero}</Text>
          <Text tone="muted">{t.sub}</Text>
        </View>
        <Button label={t.cta} onPress={() => router.push('/onboarding')} />
        <Text variant="small" tone="muted">{t.quizNote}</Text>
        <View style={{ gap: spacing.md }}>
          {t.points.map((p) => (
            <Card key={p.title} style={{ gap: spacing.xs }}>
              <Text variant="heading">{p.title}</Text>
              <Text tone="muted">{p.body}</Text>
            </Card>
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {(['terms', 'privacy', 'health'] as const).map((k) => (
            <Button key={k} label={en.home.legal[k]} variant="ghost" onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: k } })} />
          ))}
        </View>
        <Button label={t.signIn} variant="secondary" onPress={() => router.push('/sign-in')} />
      </ScrollView>
    </SafeAreaView>
  );
}
