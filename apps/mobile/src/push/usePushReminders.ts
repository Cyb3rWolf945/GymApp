import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { type EnableResult, disablePush, enablePush, fetchPushEnabled, pushSupported } from './register';

export type PushError = 'denied' | 'error' | null;

/** State and toggle for the Settings switch. */
export function usePushReminders(): { supported: boolean; enabled: boolean; busy: boolean; error: PushError; toggle: () => Promise<void> } {
  const { user } = useAuth();
  const userId = user?.id;
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<PushError>(null);

  useEffect(() => {
    if (!userId || !pushSupported) return;
    let on = true;
    void fetchPushEnabled(userId).then((v) => on && setEnabled(v));
    return () => {
      on = false;
    };
  }, [userId]);

  const toggle = useCallback(async () => {
    if (!userId || busy) return;
    setBusy(true);
    setError(null);
    if (enabled) {
      if (await disablePush(userId)) setEnabled(false);
      else setError('error');
    } else {
      const r: EnableResult = await enablePush(userId);
      if (r === 'enabled') setEnabled(true);
      else if (r === 'denied') setError('denied');
      else setError('error');
    }
    setBusy(false);
  }, [userId, enabled, busy]);

  return { supported: pushSupported, enabled, busy, error, toggle };
}
