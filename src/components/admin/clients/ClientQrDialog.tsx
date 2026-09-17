'use client';

import { QRCodeSVG } from 'qrcode.react';
import { Copy, QrCode } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useJson } from '@/hooks/useJson';
import { qrLoginUrl } from './format';

type QrResponse = { qrToken: string; qrUsedAt: string | null };

// Mounted only while the dialog is open, so each opening asks the server
// again and a regenerated code never shows the old one.
function QrBody({ clientId }: { clientId: number }) {
  const { data, error } = useJson<QrResponse>(`/api/clients/${clientId}/qr`, { cache: false });

  if (error) return <p className="text-sm text-destructive">{error.message}</p>;
  if (!data) return <Skeleton className="mx-auto h-48 w-48 rounded-lg" />;

  const url = qrLoginUrl(data.qrToken);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Lien de connexion copié.');
    } catch {
      toast.error('Impossible de copier le lien.');
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className={`rounded-lg bg-white p-3 shadow-sm ${data.qrUsedAt ? 'opacity-40' : ''}`}>
        <QRCodeSVG value={url} size={192} />
      </div>
      <p className="flex items-center gap-1.5 text-center text-xs text-muted-foreground">
        <QrCode className="h-3.5 w-3.5 shrink-0" />
        {data.qrUsedAt
          ? 'Code déjà utilisé. Régénérez-le depuis « Modifier » si le résident en a besoin d’un nouveau.'
          : 'À scanner une seule fois pour activer le compte.'}
      </p>
      {!data.qrUsedAt && (
        <Button variant="outline" size="sm" onClick={copy} className="gap-1.5 text-xs">
          <Copy className="h-3.5 w-3.5" /> Copier le lien
        </Button>
      )}
    </div>
  );
}

export function ClientQrDialog({ clientId, label, open, onOpenChange }: {
  clientId: number | null;
  label: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Code QR de connexion</DialogTitle>
          <DialogDescription>{label}</DialogDescription>
        </DialogHeader>
        {open && clientId !== null && <QrBody clientId={clientId} />}
      </DialogContent>
    </Dialog>
  );
}
