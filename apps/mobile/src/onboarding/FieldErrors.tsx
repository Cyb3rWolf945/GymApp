import { type ComponentRef, type ReactNode, type RefObject, createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, ScrollView, View, findNodeHandle } from 'react-native';
import { type PartialAnswers, type StepId, stepFieldErrors } from '@gymapp/shared';
import { trackEvent } from '../analytics/track';
import { en } from '../copy/en';
import { useTheme } from '../theme';
import { Text } from '../ui';
import { fieldMessage, unitsOf } from './fieldMessages';

type ScrollRef = ComponentRef<typeof ScrollView>;

interface Ctx {
  /** Message to show under each field (by field name). Only fields that failed on Continue and are still wrong. */
  messages: Record<string, string>;
  register: (field: string, node: unknown) => void;
}
const FieldErrorsContext = createContext<Ctx>({ messages: {}, register: () => undefined });
export const FieldErrorsProvider = FieldErrorsContext.Provider;

/** The message under a field: an icon and words (not colour alone), announced when it appears, linked to its field. */
function InlineError({ id, message }: { id: string; message: string }) {
  const { spacing } = useTheme();
  return (
    <View nativeID={id} accessibilityRole="alert" aria-live="assertive" style={{ flexDirection: 'row', gap: spacing.xs, alignItems: 'flex-start' }}>
      <Text variant="small" tone="danger" accessibilityElementsHidden importantForAccessibility="no">⚠</Text>
      <Text variant="small" tone="danger" style={{ flex: 1 }}>{message}</Text>
    </View>
  );
}

/**
 * Wraps one answer of a step. When that answer has an error, the message appears right under it. The wrapper can take
 * focus, so Continue can scroll to the first field with an error and move focus there.
 */
export function Field({ name, children }: { name: string; children: ReactNode }) {
  const { messages, register } = useContext(FieldErrorsContext);
  const { spacing } = useTheme();
  const message = messages[name];
  const errorId = `error-${name.replace(/\./g, '-')}`;
  const ref = useRef<ComponentRef<typeof View>>(null);
  useEffect(() => {
    register(name, ref.current);
    return () => register(name, null);
  }, [name, register]);
  return (
    <View
      ref={ref}
      tabIndex={-1}
      role="group"
      aria-invalid={message ? true : undefined}
      aria-describedby={message ? errorId : undefined}
      style={{ gap: spacing.sm }}
    >
      {children}
      {message ? <InlineError id={errorId} message={message} /> : null}
    </View>
  );
}

/** Scroll the field into view and move focus to it (the keyboard cursor on the web, the screen reader on the phone). */
function focusField(node: unknown, scroll: ScrollRef | null) {
  if (!node) return;
  if (Platform.OS === 'web') {
    const el = node as { scrollIntoView?: (o: object) => void; focus?: (o?: object) => void };
    el.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    el.focus?.({ preventScroll: true });
    return;
  }
  const host = node as { measureLayout?: (relativeTo: unknown, ok: (x: number, y: number) => void, fail: () => void) => void };
  const inner = (scroll as unknown as { getInnerViewRef?: () => unknown } | null)?.getInnerViewRef?.();
  if (inner) host.measureLayout?.(inner, (_x, y) => scroll?.scrollTo({ y: Math.max(0, y - 24), animated: true }), () => undefined);
  const tag = findNodeHandle(node as never);
  if (tag) AccessibilityInfo.setAccessibilityFocus(tag);
}

/**
 * Field errors for a step screen. Nothing shows until Continue (or Save) is pressed: then every field that is wrong gets
 * its message, the first one is scrolled to and focused, and each message goes away as soon as its field is valid.
 */
export function useStepErrors(id: StepId, answers: PartialAnswers, scroll: RefObject<ScrollRef | null>) {
  const [revealed, setRevealed] = useState<string[]>([]);
  const nodes = useRef(new Map<string, unknown>());
  const register = useCallback((field: string, node: unknown) => {
    if (node) nodes.current.set(field, node);
    else nodes.current.delete(field);
  }, []);

  const units = unitsOf(answers);
  const stillWrong = stepFieldErrors(id, answers).filter((e) => revealed.includes(e.field));
  const messages: Record<string, string> = {};
  let unexpected = false;
  for (const e of stillWrong) {
    const text = fieldMessage(e, units);
    if (text === null) unexpected = true;
    else messages[e.field] = text;
  }

  /** Call when Continue is pressed on an invalid step. */
  const reveal = useCallback(() => {
    const errors = stepFieldErrors(id, answers);
    setRevealed(errors.map((e) => e.field));
    // An error with no specific message: say so (step and field only, never the value) so it gets one.
    for (const e of errors) if (fieldMessage(e, units) === null) trackEvent('onboarding_validation_unknown', { step: id, field: e.field });
    const first = errors[0];
    if (first) setTimeout(() => focusField(nodes.current.get(first.field), scroll.current), 60);
  }, [id, answers, units, scroll]);

  return {
    messages,
    register,
    reveal,
    /** A generic line for the rare error that has no specific message. */
    generic: unexpected ? en.onboarding.fieldErrors.generic : null,
  };
}
