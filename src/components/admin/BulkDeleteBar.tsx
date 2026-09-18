'use client';

import { useState } from 'react';
import { Loader2, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { BULK_ENTITIES, deletedMessage, type BulkEntity } from '@/lib/bulk-delete';

type Refusal = { id: number; name: string; reason: string };

/**
 * Appears once rows are ticked: how many, and the one action that applies to
 * all of them. Rows the server refuses are named, so nobody has to guess why
 * the count went down by less than expected.
 */
export function BulkDeleteBar({ entity, ids, onClear, onDone }: {
  entity: BulkEntity;
  ids: number[];
  onClear: () => void;
  /** Called with the ids actually deleted, so the list can drop them. */
  onDone: (deletedIds: number[]) => void;
}) {
  const { confirm, confirmDialog } = useConfirm();
  const [busy, setBusy] = useState(false);

  if (ids.length === 0) return confirmDialog;

  const { label, plural } = BULK_ENTITIES[entity];
  const noun = ids.length === 1 ? label : plural;

  const remove = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity, ids }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error || 'Suppression impossible.');
        return;
      }

      const refused: Refusal[] = body.refused ?? [];
      if (body.deleted > 0) toast.success(`${deletedMessage(entity, body.deleted)}.`);

      if (refused.length > 0) {
        toast.warning(
          `${refused.length} non supprimé${refused.length > 1 ? 's' : ''}`,
          { description: refused.slice(0, 3).map(r => `${r.name} — ${r.reason}`).join('\n'), duration: 8000 },
        );
      }

      const refusedIds = new Set(refused.map(r => r.id));
      onDone(ids.filter(id => !refusedIds.has(id)));
    } catch {
      toast.error('Erreur de connexion.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="sticky bottom-4 z-30 mx-auto flex w-fit items-center gap-3 rounded-full border border-border bg-card px-3 py-2 shadow-lg">
        <span className="pl-1 text-sm font-medium tabular-nums">
          {ids.length} {noun} sélectionné{ids.length > 1 ? 's' : ''}
        </span>
        <Button
          size="sm"
          variant="destructive"
          disabled={busy}
          onClick={() => confirm({
            title: `Supprimer ${ids.length} ${noun} ?`,
            description: 'Les éléments partent à la corbeille et restent récupérables depuis l’historique.',
            confirmLabel: `Supprimer ${ids.length}`,
            onConfirm: remove,
          })}
          className="gap-1.5"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          Supprimer
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={onClear} title="Annuler la sélection">
          <X className="h-4 w-4" />
          <span className="sr-only">Annuler la sélection</span>
        </Button>
      </div>
      {confirmDialog}
    </>
  );
}
