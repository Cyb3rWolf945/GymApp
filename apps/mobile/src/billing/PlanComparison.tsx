import { View } from 'react-native';
import { PAID_TIERS, type PaidTier } from '@gymapp/shared';
import { en } from '../copy/en';
import { useTheme } from '../theme';
import { Card, Icon, Text } from '../ui';

const t = en.paywall;

/** One cell of the table in words, for screen readers. */
const spoken = (v: boolean | string) => (typeof v === 'string' ? v : v ? t.compare.included : t.compare.notIncluded);

/**
 * Basic, Pro and Elite side by side: a row per feature, a tick where it is included, a dash where it is not, and a short
 * note where the plans differ in degree. Each row reads as one sentence to a screen reader.
 */
export function PlanComparison() {
  const { colors, spacing } = useTheme();
  const col = { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const };
  return (
    <Card testID="plan-comparison" style={{ gap: spacing.xs }}>
      <Text variant="heading">{t.compare.title}</Text>
      <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', alignItems: 'center', paddingTop: spacing.sm }}>
        <View style={{ flex: 2 }} />
        {PAID_TIERS.map((tier) => (
          <View key={tier} style={col}>
            <Text variant="bodyStrong" tone={tier === 'pro' ? 'accent' : undefined}>{t.plans[tier].name}</Text>
          </View>
        ))}
      </View>
      {t.compare.rows.map((row) => (
        <View
          key={row.label}
          testID="compare-row"
          accessible
          accessibilityLabel={`${row.label}: ${PAID_TIERS.map((tier: PaidTier) => `${t.plans[tier].name} ${spoken(row[tier])}`).join(', ')}`}
          style={{ flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingVertical: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border }}
        >
          <View style={{ flex: 2, paddingRight: spacing.sm }}>
            <Text>{row.label}</Text>
          </View>
          {PAID_TIERS.map((tier) => {
            const v = row[tier];
            return (
              <View key={tier} style={col}>
                {typeof v === 'string' ? (
                  <Text variant="small" tone="muted" style={{ textAlign: 'center' }}>{v}</Text>
                ) : v ? (
                  <Icon name="checkmark-circle" size={22} tone="accent" />
                ) : (
                  <Icon name="remove" size={22} tone="muted" />
                )}
              </View>
            );
          })}
        </View>
      ))}
    </Card>
  );
}
