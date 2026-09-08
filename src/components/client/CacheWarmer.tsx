'use client';

import { useEffect } from 'react';

const WARM_ROUTES = ['/client', '/client/issues', '/client/issues/new', '/client/contract'];

export function CacheWarmer() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !navigator.onLine) return;

    navigator.serviceWorker.ready.then(() => {
      WARM_ROUTES.forEach(route => {
        fetch(route).catch(() => {});
      });
    });
  }, []);

  return null;
}
