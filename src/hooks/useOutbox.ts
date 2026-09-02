import { useEffect, useState } from 'react';
import { flushOutbox, getPendingCount, subscribe } from '@/lib/outbox';

export function useOutbox() {
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    getPendingCount().then(count => {
      if (!cancelled) setPendingCount(count);
    });

    const unsubscribe = subscribe(() => {
      getPendingCount().then(count => {
        if (!cancelled) setPendingCount(count);
      });
    });

    flushOutbox();
    const onOnline = () => flushOutbox();
    const onVisible = () => {
      if (document.visibilityState === 'visible') flushOutbox();
    };

    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      unsubscribe();
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return { pendingCount };
}
