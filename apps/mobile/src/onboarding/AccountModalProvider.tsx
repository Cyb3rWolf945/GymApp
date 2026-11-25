import { type ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PAID_TIERS, TRIAL_DAYS, formatUsd, lowestMonthlyCents } from '@gymapp/shared';
import { trackEvent } from '../analytics/track';
import { useAuth } from '../auth/AuthProvider';
import { SignInForm, type SignInMethod } from '../auth/SignInForm';
import { DEFAULT_SELECTION, type PlanSelection, usePlanPicker } from '../billing/PlanPicker';
import { en } from '../copy/en';
import { FadeSlideIn } from '../motion';
import { fetchHasPaidPlan, fetchPublicPrices } from '../plan/api';
import { useTheme } from '../theme';
import { BottomSheet, Button, Text } from '../ui';
import { type AccountModalEvent, type AccountModalState, accountModalReducer, isOpen, stepOf } from './accountModal';

const t = en.plan.generating;

// The two-step account modal on "Building your plan…": 1 of 2 Your account, 2 of 2 Your plan (E-42, E-62).
// It lives above the signed-in / signed-out route guard, so when the account is created the modal stays where it is
// and turns into step 2 in place, instead of vanishing with the signed-out screen.

interface Ctx {
  state: AccountModalState;
  dispatch: (event: AccountModalEvent) => void;
}
const AccountModalContext = createContext<Ctx>({ state: 'waiting', dispatch: () => {} });
export const useAccountModal = (): Ctx => useContext(AccountModalContext);

const PENDING_KEY = 'fuelift.account_modal.pending';
const SELECTION_KEY = 'fuelift.account_modal.selection';
const store = {
  get: async (k: string) => {
    try {
      return await AsyncStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: async (k: string, v: string) => {
    try {
      await AsyncStorage.setItem(k, v);
    } catch {
      /* storage can be blocked; the modal still works in memory */
    }
  },
  del: async (k: string) => {
    try {
      await AsyncStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
};

const parseSelection = (raw: string | null): PlanSelection | null => {
  try {
    const v = JSON.parse(raw ?? 'null') as { tier?: string; interval?: string } | null;
    return v && (PAID_TIERS as readonly string[]).includes(v.tier ?? '') && (v.interval === 'month' || v.interval === 'year') ? (v as PlanSelection) : null;
  } catch {
    return null;
  }
};

/** Step 1: the one-line price teaser (from the same prices as the paywall), the form. */
function AccountStep({ onMethod }: { onMethod: (m: SignInMethod) => void }) {
  const [from, setFrom] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    fetchPublicPrices().then(
      (rows) => {
        const cents = lowestMonthlyCents(rows);
        if (active && cents !== null) setFrom(formatUsd(cents));
      },
      () => {}, // no teaser is better than a wrong one
    );
    return () => {
      active = false;
    };
  }, []);
  return (
    <FadeSlideIn direction="forward">
      <View style={{ gap: 16 }}>
        <Text variant="small" tone="muted" accessibilityLiveRegion="polite">{t.stepIndicator(1)}</Text>
        {from ? <Text variant="small" tone="accent">{t.teaser(from, TRIAL_DAYS)}</Text> : null}
        <Text tone="muted">{t.accountBody}</Text>
        <SignInForm showHeading={false} onMethod={onMethod} />
      </View>
    </FadeSlideIn>
  );
}

/** Step 2: the plans. Its own sheet so the picker's pinned button is the sheet's footer. */
function PlanStep({ initial, onSkip, onDismiss, onCheckoutStart }: { initial: PlanSelection; onSkip: () => void; onDismiss: () => void; onCheckoutStart: (s: PlanSelection) => void }) {
  const web = Platform.OS === 'web';
  const picker = usePlanPicker({
    placement: 'account_modal',
    mode: 'select',
    initial,
    onCheckoutStart,
    // "See my plan first" (web); on phones there is no checkout here, so the same exit reads "Continue".
    secondary: <Button label={web ? t.seePlan : en.common.continue} variant="secondary" onPress={onSkip} />,
  });
  return (
    <BottomSheet visible onClose={onDismiss} title={t.planTitle} closeLabel={en.common.close} dismissOnBackdrop={false} dialogFrom="medium" dialogMaxWidth={960} tall footer={picker.footer} focusKey="plan">
      <FadeSlideIn direction="forward">
        <View style={{ gap: 16 }}>
          <Text variant="small" tone="muted" accessibilityLiveRegion="polite">{t.stepIndicator(2)}</Text>
          <Text tone="muted">{t.planBody(TRIAL_DAYS)}</Text>
          {picker.body}
        </View>
      </FadeSlideIn>
    </BottomSheet>
  );
}

export function AccountModalProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const { spacing } = useTheme();
  const [state, dispatch] = useReducer(accountModalReducer, 'waiting');
  const [restored, setRestored] = useState<PlanSelection | null>(null);
  const handling = useRef(false);

  // The person just got an account: show step 2, or skip it when they already have a plan.
  const signedIn = useCallback(async (userId: string) => {
    if (handling.current) return;
    handling.current = true;
    const paid = await fetchHasPaidPlan(userId);
    handling.current = false;
    dispatch(paid ? 'signed_in_subscribed' : 'signed_in');
  }, []);

  // Sign-up or log-in finished while the modal was on step 1 (in place, no navigation).
  useEffect(() => {
    if (user && (state === 'account' || state === 'closed_account')) void signedIn(user.id);
  }, [user, state, signedIn]);

  // Coming back to the app: from a Google/Apple redirect (web) or from a cancelled Stripe Checkout.
  useEffect(() => {
    if (loading) return;
    let active = true;
    void (async () => {
      const pending = (await store.get(PENDING_KEY)) !== null;
      if (pending) await store.del(PENDING_KEY);
      if (!active) return;
      if (pending && user) void signedIn(user.id);
      if (Platform.OS === 'web' && user && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('checkout') === 'cancelled') {
        const sel = parseSelection(await store.get(SELECTION_KEY));
        if (!active) return;
        if (sel) setRestored(sel);
        dispatch('checkout_cancelled');
        window.history.replaceState(null, '', window.location.pathname);
      }
    })();
    return () => {
      active = false;
    };
    // Once, when auth has loaded: the redirect return is a page load.
  }, [loading]);

  useEffect(() => {
    if (state === 'account') trackEvent('account_modal_view', {});
  }, [state]);

  const onMethod = (method: SignInMethod) => {
    trackEvent('signin_method_chosen', { method });
    // A Google or Apple redirect leaves the page: remember that the modal was waiting for it, to reopen on step 2.
    if (Platform.OS === 'web' && (method === 'google' || method === 'apple')) void store.set(PENDING_KEY, '1');
  };
  const skip = () => {
    trackEvent('plan_step_skipped', {});
    dispatch('skip');
  };

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return (
    <AccountModalContext.Provider value={value}>
      {children}
      {state === 'account' ? (
        <BottomSheet visible onClose={() => dispatch('dismiss')} title={t.accountTitle} closeLabel={en.common.close} dismissOnBackdrop={false} dialogFrom="medium" dialogMaxWidth={420} focusKey="account">
          <AccountStep onMethod={onMethod} />
        </BottomSheet>
      ) : null}
      {state === 'plan' ? (
        <PlanStep
          initial={restored ?? DEFAULT_SELECTION}
          onSkip={skip}
          onDismiss={() => dispatch('dismiss')}
          onCheckoutStart={(s) => void store.set(SELECTION_KEY, JSON.stringify(s))}
        />
      ) : null}
      {/* A way back to step 2 after Escape / back. (Step 1's button is on the "Building your plan…" screen itself.) */}
      {state === 'closed_plan' ? (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.xl }}>
          <Button label={t.planCta} onPress={() => dispatch('reopen')} />
        </View>
      ) : null}
    </AccountModalContext.Provider>
  );
}

export { isOpen, stepOf };
