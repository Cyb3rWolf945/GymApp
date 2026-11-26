import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '../theme';
import { type ToastItem, dismissToast, pushToast } from './logic';
import { Text } from './Text';

const AUTO_DISMISS_MS = 4000;
/** A toast with an action ("Undo") stays about 5 s, so there is time to use it. */
const ACTION_DISMISS_MS = 5000;

interface ToastApi {
  show: (message: string, tone?: ToastItem['tone'], action?: ToastItem['action']) => void;
}
const ToastContext = createContext<ToastApi>({ show: () => {} });
export const useToast = (): ToastApi => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const { colors, radius, spacing, minTapTarget } = useTheme();
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setItems((l) => dismissToast(l, id));
  }, []);
  const show = useCallback(
    (message: string, tone: ToastItem['tone'] = 'info', action?: ToastItem['action']) => {
      const id = nextId.current++;
      setItems((l) => pushToast(l, { id, message, tone, action }));
      timers.current.set(id, setTimeout(() => dismiss(id), action ? ACTION_DISMISS_MS : AUTO_DISMISS_MS));
    },
    [dismiss],
  );
  useEffect(() => {
    const t = timers.current;
    return () => t.forEach(clearTimeout);
  }, []);

  const bar = { info: colors.accentText, success: colors.success, error: colors.danger };
  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <View pointerEvents="box-none" style={{ position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.xxl, gap: spacing.sm }}>
        {items.map((t) => (
          <Pressable
            key={t.id}
            accessibilityRole="alert"
            accessibilityLabel={t.message}
            onPress={() => dismiss(t.id)}
            style={{
              minHeight: minTapTarget,
              justifyContent: 'center',
              backgroundColor: colors.surfaceAlt,
              borderRadius: radius.md,
              borderLeftWidth: 4,
              borderLeftColor: bar[t.tone],
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Text>{t.message}</Text>
              </View>
              {t.action ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t.action.label}
                  onPress={() => {
                    t.action?.onPress();
                    dismiss(t.id);
                  }}
                  style={{ minHeight: minTapTarget, minWidth: minTapTarget, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.sm }}
                >
                  <Text variant="bodyStrong" tone="accent">{t.action.label}</Text>
                </Pressable>
              ) : null}
            </View>
          </Pressable>
        ))}
      </View>
    </ToastContext.Provider>
  );
}
