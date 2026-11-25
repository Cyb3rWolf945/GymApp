import { useCallback, useEffect, useState } from 'react';
import { type CoachStyle, DEFAULT_COACH_STYLE, parseCoachStyle } from '@gymapp/shared';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../supabase';

// E-55: the person's coach style (profiles.coach_style). Calm until it loads, and whenever it cannot be read.
const listeners = new Set<(s: CoachStyle) => void>();

export function useCoachStyle(): { style: CoachStyle; save: (s: CoachStyle) => Promise<boolean> } {
  const { user } = useAuth();
  const [style, setStyle] = useState<CoachStyle>(DEFAULT_COACH_STYLE);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void supabase
      .from('profiles')
      .select('coach_style')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => active && setStyle(parseCoachStyle((data as { coach_style?: unknown } | null)?.coach_style)));
    const on = (s: CoachStyle) => setStyle(s);
    listeners.add(on);
    return () => {
      active = false;
      listeners.delete(on);
    };
  }, [user]);

  const save = useCallback(
    async (next: CoachStyle) => {
      if (!user) return false;
      const { error } = await supabase.from('profiles').update({ coach_style: next } as never).eq('user_id', user.id);
      if (error) return false;
      listeners.forEach((fn) => fn(next));
      return true;
    },
    [user],
  );
  return { style, save };
}
