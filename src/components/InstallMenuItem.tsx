'use client';

import { useState } from 'react';
import { Download, Share } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InstallInstructionsDialog } from '@/components/InstallInstructionsDialog';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';

export function InstallMenuItem({ variant = 'row' }: { variant?: 'row' | 'icon' | 'pill' }) {
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
      ) : variant === 'pill' ? (
        <Button
          variant="ghost"
          onClick={handleClick}
          className="h-8 px-2.5 gap-1.5 shrink-0 rounded-full bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary text-[11px] font-bold active:scale-95 transition-transform"
        >
          {ios ? <Share className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
          Installer
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
      <InstallInstructionsDialog open={showInfo} onOpenChange={setShowInfo} ios={ios} />
    </>
  );
}
