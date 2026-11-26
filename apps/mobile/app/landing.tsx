import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { utmProps } from '@gymapp/shared';
import { trackEvent } from '../src/analytics/track';
import { FadeSlideIn, staggerDelay, useReducedMotion } from '../src/motion';
import { en } from '../src/copy/en';
import { REVIEWS } from '../src/marketing/reviews';
import { Reviews } from '../src/marketing/Reviews';
import { captureAttribution } from '../src/marketing/tracking';
import { useBreakpoint, useTheme } from '../src/theme';
import { Button, Card, Icon, type IconName, Screen, Text } from '../src/ui';

const t = en.landing;
const POINT_ICONS: IconName[] = ['git-compare', 'person', 'trending-up'];
// The router can mount this screen twice on a first visit (anchor route plus the resolved one): count the visit once.
let visitCounted = false;

/** Web landing page for ads and search. Signed-out visitors on iOS and Android go straight to the quiz. */
export default function Landing() {
  const router = useRouter();
  const { colors, radius, spacing } = useTheme();
  const reduced = useReducedMotion();
  const wide = useBreakpoint() === 'expanded';

  useEffect(() => {
    if (Platform.OS !== 'web' || visitCounted) return;
    visitCounted = true;
    // Keep the UTM tags (first touch) and count the visit with them.
    void captureAttribution().then((a) => trackEvent('landing_view', utmProps(a)));
  }, []);

  if (Platform.OS !== 'web') return <Redirect href="/onboarding" />;
  const hero = (
    <View style={{ gap: spacing.xl }}>
      <View style={{ gap: spacing.md }}>
        <Text variant="display" accessibilityRole="header">{t.hero}</Text>
        <Text tone="muted">{t.sub}</Text>
      </View>
      <Button label={t.cta} onPress={() => router.push('/onboarding')} />
      <Text variant="small" tone="muted">{t.quizNote}</Text>
    </View>
  );
  const points = (
    <View style={{ gap: spacing.md }}>
      {t.points.map((p, i) => (
        <FadeSlideIn key={p.title} direction="up" delay={staggerDelay(i + 1, reduced)}>
          <Card style={{ gap: spacing.xs }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={POINT_ICONS[i] ?? 'sparkles'} size={24} tone="accent" />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="heading">{p.title}</Text>
              </View>
            </View>
            <Text tone="muted">{p.body}</Text>
          </Card>
        </FadeSlideIn>
      ))}
    </View>
  );
  const how = (
    <View testID="how-it-works" style={{ gap: spacing.md }}>
      <Text variant="heading" accessibilityRole="header">{t.how.title}</Text>
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: spacing.md }}>
        {t.how.steps.map((s, i) => (
          <View key={s.title} style={{ flex: wide ? 1 : undefined, flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Text variant="bodyStrong" style={{ color: colors.onAccent }}>{String(i + 1)}</Text>
            </View>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Text variant="bodyStrong">{s.title}</Text>
              <Text variant="small" tone="muted">{s.body}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
  return (
    <Screen variant={wide ? 'dashboard' : 'reading'} center>
      {/* Two columns on wide screens: the pitch and the button on the left, the benefits on the right. */}
      {wide ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xxxl }}>
          <View style={{ flex: 1 }}>{hero}</View>
          <View style={{ flex: 1 }}>{points}</View>
        </View>
      ) : (
        <>
          {hero}
          {points}
        </>
      )}
      {how}
      <Reviews reviews={REVIEWS} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {(['terms', 'privacy', 'health'] as const).map((k) => (
          <Button key={k} label={en.home.legal[k]} variant="ghost" onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: k } })} />
        ))}
      </View>
      <Button label={t.signIn} variant="secondary" onPress={() => router.push('/sign-in?mode=login')} />
    </Screen>
  );
}
