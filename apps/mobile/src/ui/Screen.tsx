import type { ReactNode } from 'react';
import { ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CONTENT_MAX_WIDTH, type ContentVariant, SCREEN_PADDING, useBreakpoint, useTheme } from '../theme';

interface Props {
  /** `reading` caps the content at about 720 px, `dashboard` at about 1200 px. */
  variant?: ContentVariant;
  /** Scroll the content (default). Pass false for screens that manage their own scrolling. */
  scroll?: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * The page frame: dark background, safe areas, and content centred with a maximum width and padding that grows with
 * the breakpoint. On phones (`compact`) the content is as wide as the screen with the same 24 px padding screens
 * already use, so nothing changes there.
 */
export function Screen({ variant = 'reading', scroll = true, children, style }: Props) {
  const { colors, spacing } = useTheme();
  const bp = useBreakpoint();
  const inner = (
    <View style={[{ width: '100%', maxWidth: CONTENT_MAX_WIDTH[variant], padding: SCREEN_PADDING[bp], gap: spacing.xl }, style]}>{children}</View>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {scroll ? (
        <ScrollView contentContainerStyle={{ alignItems: 'center', flexGrow: 1 }}>{inner}</ScrollView>
      ) : (
        <View style={{ flex: 1, alignItems: 'center' }}>{inner}</View>
      )}
    </SafeAreaView>
  );
}
