import { type ComponentRef, type ReactNode, useEffect, useRef } from 'react';
import { AccessibilityInfo, Modal, Platform, Pressable, ScrollView, View, findNodeHandle } from 'react-native';
import { useReducedMotion } from '../motion';
import { useBreakpoint, useTheme } from '../theme';
import { Text } from './Text';

interface Props {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** Accessible name of the close area (tap outside the sheet). */
  closeLabel?: string;
  /** Tapping outside closes the sheet (default). Off for sheets that must be answered, or closed on purpose (Escape / back). */
  dismissOnBackdrop?: boolean;
  /** From which width the sheet becomes a centred dialog: `expanded` (1024 px, default) or `medium` (600 px). */
  dialogFrom?: 'medium' | 'expanded';
  /** Widest the centred dialog gets (px). */
  dialogMaxWidth?: number;
  /** Stays pinned below the scrolling content (a primary button that must always be reachable). */
  footer?: ReactNode;
  /** The sheet takes almost the full height (long content such as plan cards) instead of fitting its content. */
  tall?: boolean;
  /** When this changes while open, focus moves back to the dialog (a new step has a new title to announce). */
  focusKey?: string;
  children: ReactNode;
}

/** Move focus into the sheet when it opens: the keyboard cursor on the web, the screen reader's focus on the phone. */
function useFocusOnOpen(visible: boolean, focusKey?: string) {
  const ref = useRef<ComponentRef<typeof View>>(null);
  useEffect(() => {
    if (!visible) return;
    const id = setTimeout(() => {
      const node = ref.current;
      if (!node) return;
      if (Platform.OS === 'web') (node as unknown as { focus?: () => void }).focus?.();
      else {
        const tag = findNodeHandle(node);
        if (tag) AccessibilityInfo.setAccessibilityFocus(tag);
      }
    }, 50); // after the modal has mounted its content
    return () => clearTimeout(id);
  }, [visible, focusKey]);
  return ref;
}

export function BottomSheet({ visible, onClose, title, closeLabel = 'Close', dismissOnBackdrop = true, dialogFrom = 'expanded', dialogMaxWidth = 520, footer, tall = false, focusKey, children }: Props) {
  const { colors, radius, spacing } = useTheme();
  const bp = useBreakpoint();
  const focusRef = useFocusOnOpen(visible, focusKey);
  // Slides up from the bottom, or only fades with reduced motion.
  const sheetAnimation = useReducedMotion() ? 'fade' : 'slide';
  /** The dimmed area behind the sheet: a close button, or just a dim layer when tapping outside must do nothing. */
  const backdrop = (position: 'absolute' | 'fill') => {
    const style = position === 'absolute' ? ({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.overlay } as const) : { flex: 1, backgroundColor: colors.overlay };
    return dismissOnBackdrop ? <Pressable accessibilityRole="button" accessibilityLabel={closeLabel} onPress={onClose} style={style} /> : <View style={style} />;
  };
  const dialog = dialogFrom === 'medium' ? bp !== 'compact' : bp === 'expanded';
  if (dialog) {
    // Wide screens: a centred dialog with a capped width instead of a sheet stuck to the bottom edge.
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
          {backdrop('absolute')}
          <View
            ref={focusRef}
            tabIndex={-1}
            accessibilityViewIsModal
            role="dialog"
            aria-modal
            aria-label={title}
            style={{ width: '100%', maxWidth: dialogMaxWidth, maxHeight: '90%', ...(tall ? { height: '90%' } : null), backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.lg }}
          >
            {title ? <Text variant="heading" accessibilityRole="header">{title}</Text> : null}
            <ScrollView style={tall ? { flex: 1 } : undefined} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.lg }}>{children}</ScrollView>
            {footer ? <View style={{ gap: spacing.sm }}>{footer}</View> : null}
          </View>
        </View>
      </Modal>
    );
  }
  return (
    <Modal visible={visible} transparent animationType={sheetAnimation} onRequestClose={onClose}>
      {backdrop('fill')}
      <View
        ref={focusRef}
        tabIndex={-1}
        accessibilityViewIsModal
        role="dialog"
        aria-modal
        aria-label={title}
        style={{
          maxHeight: '90%',
          ...(tall ? { height: '90%' } : null),
          backgroundColor: colors.surface,
          borderTopLeftRadius: radius.lg,
          borderTopRightRadius: radius.lg,
          padding: spacing.xl,
          paddingBottom: spacing.xxxl,
          gap: spacing.lg,
        }}
      >
        <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.divider }} />
        {title ? <Text variant="heading" accessibilityRole="header">{title}</Text> : null}
        <ScrollView style={tall ? { flex: 1 } : undefined} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.lg }}>{children}</ScrollView>
        {footer ? <View style={{ gap: spacing.sm }}>{footer}</View> : null}
      </View>
    </Modal>
  );
}
