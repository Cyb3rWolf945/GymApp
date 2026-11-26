import { useEffect, useState } from 'react';
import type { BodyVariant } from '@gymapp/shared';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../supabase';

const cache = new Map<string, BodyVariant>();

/** Which body to draw: from the profile's `sex`; the neutral one while it loads or when it is unknown. */
export function useBodyVariant(): BodyVariant {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [variant, setVariant] = useState<BodyVariant>(() => (userId ? cache.get(userId) : undefined) ?? 'neutral');
  useEffect(() => {
    if (!userId) return;
    const known = cache.get(userId);
    if (known) return setVariant(known);
    let active = true;
    void supabase
      .from('profiles')
      .select('sex')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        const sex = (data as { sex?: string } | null)?.sex;
        const v: BodyVariant = sex === 'male' || sex === 'female' ? sex : 'neutral';
        cache.set(userId, v);
        if (active) setVariant(v);
      });
    return () => {
      active = false;
    };
  }, [userId]);
  return variant;
}
