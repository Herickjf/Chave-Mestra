import { useEffect } from 'react';
import { useSession } from './SessionContext';

export function useAutoLock() {
  const { session, lockMinutes, lock } = useSession();
  useEffect(() => {
    if (session.status !== 'unlocked') return;
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(lock, lockMinutes * 60_000);
    };
    const events = ['mousemove', 'keydown', 'click', 'touchstart'];
    events.forEach((event) => window.addEventListener(event, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach((event) => window.removeEventListener(event, reset));
    };
  }, [session, lockMinutes, lock]);
}
