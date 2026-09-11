'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export function InstallInstructionsDialog({
  open,
  onOpenChange,
  ios,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ios: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Installer l&apos;application</DialogTitle>
          <DialogDescription>
            {ios
              ? "Appuyez sur le bouton de partage de Safari, puis « Sur l'écran d'accueil »."
              : "Utilisez le menu de votre navigateur (généralement les trois points en haut à droite) et choisissez « Installer l'application » ou « Ajouter à l'écran d'accueil »."}
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Si l&apos;application est d&eacute;j&agrave; install&eacute;e, ouvrez-la directement depuis votre &eacute;cran d&apos;accueil.
        </p>
      </DialogContent>
    </Dialog>
  );
}
