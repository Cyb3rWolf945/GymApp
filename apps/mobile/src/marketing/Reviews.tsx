import { View } from 'react-native';
import { type Review, usableReviews } from '@gymapp/shared';
import { en } from '../copy/en';
import { useBreakpoint, useTheme } from '../theme';
import { Card, Icon, Text } from '../ui';

const t = en.landing;

/** Real reviews, three at most, side by side from `medium` up. Draws nothing until there are some. */
export function Reviews({ reviews }: { reviews: readonly Review[] }) {
  const { spacing } = useTheme();
  const wide = useBreakpoint() !== 'compact';
  const shown = usableReviews(reviews);
  if (shown.length === 0) return null;
  return (
    <View testID="reviews" style={{ gap: spacing.md }}>
      <Text variant="heading" accessibilityRole="header">{t.reviewsTitle}</Text>
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: spacing.md }}>
        {shown.map((r) => (
          <View key={`${r.name}-${r.quote}`} style={{ flex: wide ? 1 : undefined }}>
            <Card style={{ gap: spacing.sm }}>
              <View accessible accessibilityLabel={t.rated(r.rating)} style={{ flexDirection: 'row', gap: 2 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Icon key={n} name={n <= r.rating ? 'star' : 'star-outline'} size={18} tone="accent" />
                ))}
              </View>
              <Text>{`“${r.quote}”`}</Text>
              <Text variant="small" tone="muted">{`${r.name} · ${r.source}`}</Text>
            </Card>
          </View>
        ))}
      </View>
    </View>
  );
}
