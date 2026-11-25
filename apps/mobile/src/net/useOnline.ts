import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

/** `true` / `false` from the browser (web) or the OS (phone); `null` until the first reading. Live: it changes when the connection does. */
export function useOnline(): boolean | null {
  const [online, setOnline] = useState<boolean | null>(() => (Platform.OS === 'web' && typeof navigator !== 'undefined' ? navigator.onLine : null));
  useEffect(() => {
    if (Platform.OS === 'web') {
      const up = () => setOnline(true);
      const down = () => setOnline(false);
      window.addEventListener('online', up);
      window.addEventListener('offline', down);
      setOnline(navigator.onLine);
      return () => {
        window.removeEventListener('online', up);
        window.removeEventListener('offline', down);
      };
    }
    // Loaded here: the native module does not exist on web.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const NetInfo = (require('@react-native-community/netinfo') as typeof import('@react-native-community/netinfo')).default;
    // `isInternetReachable` is null while it is still checking: only a definite "no" counts as offline.
    return NetInfo.addEventListener((s) => setOnline(s.isConnected === false || s.isInternetReachable === false ? false : true));
  }, []);
  return online;
}
