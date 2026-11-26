import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { legalDoc } from '@gymapp/shared';
import { en } from '../../src/copy/en';
import { useTheme } from '../../src/theme';
import { Button, Card, EmptyState, Screen, Text } from '../../src/ui';

const t = en.home.legal;

/** Terms, privacy policy and health disclaimer. Public: on the web they live at /legal/terms, /legal/privacy and /legal/health. */
export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const router = useRouter();
  const { colors, spacing } = useTheme();
  const page = legalDoc(String(doc));
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <Screen>
        {page ? (
          <>
            <Text variant="display">{page.title}</Text>
            {/* Templates must never read as final: this banner stays until a lawyer has approved the text. */}
            <Card style={{ borderColor: colors.danger, borderWidth: 1 }}>
              <Text variant="small" tone="danger" accessibilityRole="alert">{page.reviewNotice}</Text>
            </Card>
            <Text variant="small" tone="muted">{`Version ${page.version}`}</Text>
            {page.sections.map((s) => (
              <View key={s.heading} style={{ gap: spacing.xs }}>
                <Text variant="heading">{s.heading}</Text>
                <Text>{s.body}</Text>
              </View>
            ))}
          </>
        ) : (
          <EmptyState kind="missing" title={t.missing} />
        )}
        <Button label={t.back} variant="secondary" onPress={back} />
    </Screen>
  );
}
