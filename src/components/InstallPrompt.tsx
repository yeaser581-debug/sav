'use client';

import { useEffect, useState } from 'react';
import { Download, X, Share } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DISMISS_KEY = 'as-install-prompt-dismissed';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function isIos() {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    if (isStandalone()) return;
    let dismissed = false;
    try { dismissed = localStorage.getItem(DISMISS_KEY) === '1'; } catch {}
    if (dismissed) return;

    if (isIos()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIos(true);
      setVisible(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const dismiss = () => {
    setVisible(false);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch {}
  };

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 md:bottom-4 inset-x-4 md:left-auto md:right-4 md:w-80 z-50 bg-card border border-border rounded-2xl shadow-lg p-4 flex items-start gap-3">
      <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0">
        {ios ? <Share className="h-4 w-4" /> : <Download className="h-4 w-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground">Installer l&apos;application</p>
        {ios ? (
          <p className="text-xs text-muted-foreground mt-0.5">
            Appuyez sur <Share className="h-3 w-3 inline align-text-bottom" /> puis « Sur l&apos;écran d&apos;accueil » pour un accès rapide.
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mt-0.5">Accédez plus rapidement depuis votre écran d&apos;accueil.</p>
            <Button onClick={install} size="sm" className="mt-2 h-7 text-xs bg-primary text-primary-foreground hover:bg-primary/90">
              Installer
            </Button>
          </>
        )}
      </div>
      <button onClick={dismiss} className="text-muted-foreground hover:text-foreground shrink-0">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
