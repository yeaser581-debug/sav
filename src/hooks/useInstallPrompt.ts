import { useEffect, useState } from 'react';

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

declare global {
  interface Window {
    __installPrompt?: BeforeInstallPromptEvent | null;
  }
}

export function isIos() {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function isMobile() {
  if (typeof navigator === 'undefined') return false;
  return /android|iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function isStandalone() {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIos(isIos());
    setStandalone(isStandalone());
    setDeferredPrompt(window.__installPrompt ?? null);

    const onInstalled = () => {
      window.__installPrompt = null;
      setDeferredPrompt(null);
      setStandalone(true);
      setJustInstalled(true);
    };
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      window.__installPrompt = e as BeforeInstallPromptEvent;
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onPromptChange = () => setDeferredPrompt(window.__installPrompt ?? null);

    window.addEventListener('appinstalled', onInstalled);
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('installpromptchange', onPromptChange);
    return () => {
      window.removeEventListener('appinstalled', onInstalled);
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('installpromptchange', onPromptChange);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    window.__installPrompt = null;
    setDeferredPrompt(null);
  };

  return {
    canInstall: deferredPrompt !== null,
    ios,
    standalone,
    install,
    justInstalled,
    clearJustInstalled: () => setJustInstalled(false),
  };
}
