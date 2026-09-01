'use client';

import { useState } from 'react';
import { Download, Share } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';

export function InstallMenuItem({ variant = 'row' }: { variant?: 'row' | 'icon' }) {
  const { canInstall, ios, standalone, install } = useInstallPrompt();
  const [showInfo, setShowInfo] = useState(false);

  if (standalone) return null;

  const handleClick = () => {
    if (canInstall) {
      install();
    } else {
      setShowInfo(true);
    }
  };

  return (
    <>
      {variant === 'icon' ? (
        <Button variant="ghost" size="icon-sm" onClick={handleClick} className="text-muted-foreground hover:text-foreground">
          {ios ? <Share className="h-4 w-4" /> : <Download className="h-4 w-4" />}
        </Button>
      ) : (
        <Button
          variant="ghost"
          onClick={handleClick}
          className="w-full justify-start gap-2 h-8 text-muted-foreground hover:text-foreground hover:bg-accent px-3 text-sm"
        >
          {ios ? <Share className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
          Installer l&apos;application
        </Button>
      )}

      <Dialog open={showInfo} onOpenChange={setShowInfo}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Installer l&apos;application</DialogTitle>
            <DialogDescription>
              {ios
                ? "Appuyez sur le bouton de partage de Safari, puis « Sur l'écran d'accueil »."
                : "Utilisez le menu de votre navigateur (généralement les trois points en haut à droite) et choisissez « Installer l'application » ou « Ajouter à l'écran d'accueil »."}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
}
