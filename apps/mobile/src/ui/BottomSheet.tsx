import type { ReactNode } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useBreakpoint, useTheme } from '../theme';
import { Text } from './Text';

interface Props {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** Accessible name of the close area (tap outside the sheet). */
  closeLabel?: string;
  children: ReactNode;
}

export function BottomSheet({ visible, onClose, title, closeLabel = 'Close', children }: Props) {
  const { colors, radius, spacing } = useTheme();
  const dialog = useBreakpoint() === 'expanded';
  if (dialog) {
    // Wide screens: a centred dialog with a capped width instead of a sheet stuck to the bottom edge.
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
          <Pressable accessibilityRole="button" accessibilityLabel={closeLabel} onPress={onClose} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.overlay }} />
          <View
            accessibilityViewIsModal
            style={{ width: '100%', maxWidth: 520, maxHeight: '90%', backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.lg }}
          >
            {title ? <Text variant="heading">{title}</Text> : null}
            {children}
          </View>
        </View>
      </Modal>
    );
  }
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityRole="button" accessibilityLabel={closeLabel} onPress={onClose} style={{ flex: 1, backgroundColor: colors.overlay }} />
      <View
        accessibilityViewIsModal
        style={{
          backgroundColor: colors.surface,
          borderTopLeftRadius: radius.lg,
          borderTopRightRadius: radius.lg,
          padding: spacing.xl,
          paddingBottom: spacing.xxxl,
          gap: spacing.lg,
        }}
      >
        <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
        {title ? <Text variant="heading">{title}</Text> : null}
        {children}
      </View>
    </Modal>
  );
}
