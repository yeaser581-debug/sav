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

  useEffect(() => {
    let wasDismissed = false;
    try { wasDismissed = localStorage.getItem(DISMISS_KEY) === '1'; } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(wasDismissed);
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch {}
  };

  const visible = !standalone && !dismissed && (ios || canInstall);

  return (
    <>
      {visible && (
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
