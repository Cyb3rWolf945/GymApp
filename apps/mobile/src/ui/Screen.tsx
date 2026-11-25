import type { ReactNode } from 'react';
import { ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CONTENT_MAX_WIDTH, type ContentVariant, SCREEN_PADDING, useBreakpoint, useTheme } from '../theme';

interface Props {
  /** `reading` caps the content at about 720 px, `dashboard` at about 1200 px. */
  variant?: ContentVariant;
  /** Scroll the content (default). Pass false for screens that manage their own scrolling. */
  scroll?: boolean;
  /** Centre the content vertically when it is shorter than the screen (sign-in, generating, empty states). */
  center?: boolean;
  /** From `medium` up, put the content in a card (surface colour, border, rounded) instead of on the bare background. */
  framed?: boolean;
  /** Stays above the scrolling content (e.g. a progress indicator). Same width and padding as the content. */
  header?: ReactNode;
  /** Stays below the scrolling content (e.g. the main button). Same width and padding as the content. */
  footer?: ReactNode;
  /** Keep the keyboard open when tapping buttons (screens with text fields). */
  keyboardTaps?: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * The page frame: dark background, safe areas, and content centred with a maximum width and padding that grows with
 * the breakpoint. On phones (`compact`) the content is as wide as the screen with the same 24 px padding screens
 * already use, so nothing changes there.
 */
export function Screen({ variant = 'reading', scroll = true, center = false, framed = false, header, footer, keyboardTaps = false, children, style }: Props) {
  const { colors, radius, spacing } = useTheme();
  const bp = useBreakpoint();
  const card = framed && bp !== 'compact';
  const width = { width: '100%', maxWidth: CONTENT_MAX_WIDTH[variant] } as const;
  const inner = (
    <View
      style={[
        { ...width, padding: SCREEN_PADDING[bp], gap: spacing.xl },
        card && { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, marginVertical: spacing.xl },
        style,
      ]}
    >
      {children}
    </View>
  );
  // The header and footer sit outside the scroll area: same column, same padding.
  const edge = (node: ReactNode, top: boolean) =>
    node ? (
      <View style={{ alignItems: 'center' }}>
        <View style={{ ...width, padding: SCREEN_PADDING[bp], paddingTop: top ? SCREEN_PADDING[bp] : undefined, paddingBottom: top ? 0 : undefined, gap: spacing.sm }}>{node}</View>
      </View>
    ) : null;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {edge(header, true)}
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ alignItems: 'center', flexGrow: 1, justifyContent: center ? 'center' : 'flex-start' }}
          keyboardShouldPersistTaps={keyboardTaps ? 'handled' : undefined}
        >
          {inner}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: center ? 'center' : 'flex-start' }}>{inner}</View>
      )}
      {edge(footer, false)}
    </SafeAreaView>
  );
}
