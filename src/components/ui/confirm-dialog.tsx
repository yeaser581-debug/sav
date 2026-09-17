'use client';

import { useCallback, useState } from 'react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export type ConfirmRequest = {
  /** Asks the question, naming the thing: "Supprimer « Atlas » ?" */
  title: string;
  /** What happens next, and whether it can be undone. */
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Paints the confirm button as a danger action. Default: true. */
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
};

/**
 * One confirmation dialog per screen, opened from any handler:
 *
 *   const { confirm, confirmDialog } = useConfirm();
 *   confirm({ title: 'Supprimer « Atlas » ?', onConfirm: () => remove(area) });
 *   return <>{…}{confirmDialog}</>;
 */
export function useConfirm() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  const confirm = useCallback((next: ConfirmRequest) => setRequest(next), []);
  const close = useCallback(() => setRequest(null), []);

  const confirmDialog = (
    <AlertDialog open={request !== null} onOpenChange={open => { if (!open) close(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{request?.title}</AlertDialogTitle>
          {request?.description && <AlertDialogDescription>{request.description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{request?.cancelLabel ?? 'Annuler'}</AlertDialogCancel>
          <AlertDialogAction
            variant={request?.destructive === false ? 'default' : 'destructive'}
            onClick={() => { void request?.onConfirm(); }}
          >
            {request?.confirmLabel ?? 'Supprimer'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirm, confirmDialog };
}
