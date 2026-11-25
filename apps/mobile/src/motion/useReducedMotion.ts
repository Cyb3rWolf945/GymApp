import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/** The OS "reduce motion" setting (the browser's `prefers-reduced-motion` on the web). Read at once on the web, so there is no first frame of motion. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false,
  );
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => active && setReduced(v), () => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      active = false;
      sub.remove();
    };
  }, []);
  return reduced;
}
