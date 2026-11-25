import type { ReactNode } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useTheme } from '../theme';
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
