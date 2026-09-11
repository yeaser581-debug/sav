'use client';

import { useState } from 'react';
import { Download, Share, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InstallInstructionsDialog } from '@/components/InstallInstructionsDialog';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';

export function InstallCard() {
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
      <div className="rounded-2xl border border-primary/25 bg-accent p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="h-12 w-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-md shadow-primary/20">
          <Smartphone className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-accent-foreground">Installez l&apos;application</p>
          <p className="text-sm text-accent-foreground/80 mt-0.5 leading-relaxed">
            Retrouvez vos r&eacute;clamations directement sur votre &eacute;cran d&apos;accueil, m&ecirc;me sans connexion.
          </p>
        </div>
        <Button
          onClick={handleClick}
          className="shrink-0 h-11 px-6 text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl shadow-md shadow-primary/20 active:scale-95 transition-transform gap-2"
        >
          {ios ? <Share className="h-4 w-4" /> : <Download className="h-4 w-4" />}
          Installer
        </Button>
      </div>
      <InstallInstructionsDialog open={showInfo} onOpenChange={setShowInfo} ios={ios} />
    </>
  );
}
