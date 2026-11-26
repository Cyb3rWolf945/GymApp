import { type PartialAnswers, previewTargets } from '@gymapp/shared';
import { en } from '../copy/en';
import { FadeSlideIn, useCountUp } from '../motion';
import { useTheme } from '../theme';
import { Card, Text } from '../ui';

const t = en.onboarding.livePreview;
const fmt = (n: number) => n.toLocaleString('en-US');

function Numbers({ kcal, proteinG, carbsG, fatG }: { kcal: number; proteinG: number; carbsG: number; fatG: number }) {
  const shown = useCountUp(kcal);
  return (
    <>
      <Text variant="heading" accessibilityLabel={t.kcal(fmt(kcal))}>{t.kcal(fmt(shown))}</Text>
      <Text variant="small" tone="muted">{t.macros(proteinG, carbsG, fatG)}</Text>
    </>
  );
}

/** The calorie and macro target so far, updating as the answers change. Nothing until the answers that decide it are in. */
export function LivePreview({ answers }: { answers: PartialAnswers }) {
  const { spacing } = useTheme();
  const p = previewTargets(answers);
  if (!p) return null;
  return (
    <FadeSlideIn direction="up">
      <Card testID="live-preview" accessibilityLiveRegion="polite" style={{ gap: spacing.xs }}>
        <Text variant="small" tone="muted">{t.title}</Text>
        <Numbers {...p} />
      </Card>
    </FadeSlideIn>
  );
}
