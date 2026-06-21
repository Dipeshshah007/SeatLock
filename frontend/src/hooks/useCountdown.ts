import { useState, useEffect, useRef, useCallback } from 'react';

interface UseCountdownResult {
  secondsLeft: number;
  formatted: string; // mm:ss
  isExpired: boolean;
  reset: (newSeconds: number) => void;
}

/**
 * Drives the "seat held for 4:32" countdown shown during seat selection
 * and checkout. Purely client-side display — the actual expiry is
 * enforced server-side (Postgres held_until + the sweep job), so even if
 * this timer drifts or the tab is backgrounded, the backend is still
 * the authority on whether the hold is valid.
 */
export function useCountdown(initialSeconds: number, onExpire?: () => void): UseCountdownResult {
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (secondsLeft <= 0) {
      onExpireRef.current?.();
      return;
    }
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [secondsLeft > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = useCallback((newSeconds: number) => {
    setSecondsLeft(newSeconds);
  }, []);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const formatted = `${mins}:${secs.toString().padStart(2, '0')}`;

  return { secondsLeft, formatted, isExpired: secondsLeft <= 0, reset };
}
