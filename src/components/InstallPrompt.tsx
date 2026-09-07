'use client';

import { useEffect, useState } from 'react';
import { Download, X, Share, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useInstallPrompt, isMobile } from '@/hooks/useInstallPrompt';

const DISMISS_KEY = 'as-install-prompt-dismissed';

export function InstallPrompt() {
  const { canInstall, ios, standalone, install, justInstalled, clearJustInstalled } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(true);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    let wasDismissed = false;
    try { wasDismissed = localStorage.getItem(DISMISS_KEY) === '1'; } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(wasDismissed);
    const timer = setTimeout(() => setShown(true), 900);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch {}
  };

  useEffect(() => {
    if (dismissed) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dismissed]);

  const visible = shown && !standalone && !dismissed && (ios || canInstall);

  return (
    <>
      {visible && (
        <div
          onClick={dismiss}
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300 motion-reduce:animate-none"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="relative w-full max-w-sm bg-card border border-border rounded-3xl shadow-2xl p-7 text-center animate-in zoom-in-95 duration-300 motion-reduce:animate-none"
          >
            <button onClick={dismiss} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground" aria-label="Fermer">
              <X className="h-5 w-5" />
            </button>

            <div className="h-16 w-16 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-5 shadow-lg shadow-primary/30">
              {ios ? <Share className="h-7 w-7" /> : <Download className="h-7 w-7" />}
            </div>

            <p className="text-xl font-extrabold text-foreground">Installez l&apos;application</p>

            {ios ? (
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                Accédez plus vite à vos réclamations : appuyez sur <Share className="h-3.5 w-3.5 inline align-text-bottom" /> puis « Sur l&apos;écran d&apos;accueil ».
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  Accédez plus vite à vos réclamations et recevez vos notifications, directement depuis votre écran d&apos;accueil.
                </p>
                <Button
                  onClick={install}
                  className="w-full mt-6 h-12 text-base font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl shadow-lg shadow-primary/20 active:scale-95 transition-transform"
                >
                  <Download className="h-4 w-4 mr-2" /> Installer maintenant
                </Button>
              </>
            )}

            <button onClick={dismiss} className="block w-full mt-3 text-xs font-medium text-muted-foreground hover:text-foreground">
              Plus tard
            </button>
          </div>
        </div>
      )}

      <Dialog open={justInstalled} onOpenChange={(open) => !open && clearJustInstalled()}>
        <DialogContent className="sm:max-w-sm text-center">
          <DialogHeader className="items-center">
            <div className="h-12 w-12 rounded-full bg-success/15 text-success flex items-center justify-center mb-2">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <DialogTitle>Application installée</DialogTitle>
            <DialogDescription>
              {isMobile()
                ? "Retrouvez l'icône « After-Sales » directement sur votre écran d'accueil."
                : "Retrouvez « After-Sales » dans votre menu Démarrer, ou une nouvelle fenêtre de l'application vient de s'ouvrir."}
            </DialogDescription>
          </DialogHeader>
          <Button onClick={clearJustInstalled} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
            Compris
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
