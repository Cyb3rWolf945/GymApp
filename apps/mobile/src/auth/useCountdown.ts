import { useEffect, useState } from 'react';
import { resendWait } from './logic';

/** Seconds left on the resend cooldown since `sentAt` (epoch ms). Ticks once a second, only while it is running. */
export function useResendWait(sentAt: number | null): number {
  const [left, setLeft] = useState(() => resendWait(sentAt, Date.now()));
  useEffect(() => {
    setLeft(resendWait(sentAt, Date.now()));
    if (sentAt === null) return;
    const id = setInterval(() => {
      const next = resendWait(sentAt, Date.now());
      setLeft(next);
      if (next === 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [sentAt]);
  return left;
}
