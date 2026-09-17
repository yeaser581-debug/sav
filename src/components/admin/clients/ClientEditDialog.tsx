'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { invalidateJson, useJson } from '@/hooks/useJson';
import type { ClientBase } from './types';
import { clientLabel } from './format';
import { LIMITS } from '@/lib/limits';

type Building = { id: number; name: string };

const FIELD = 'bg-muted border-border text-foreground';

function EditForm({ client, onDone }: { client: ClientBase; onDone: () => void }) {
  const { data: buildings } = useJson<Building[]>('/api/buildings');
  const [form, setForm] = useState({
    login: client.login,
    name: client.name ?? '',
    unitNumber: client.unitNumber ?? '',
    phone: client.phone ?? '',
    email: client.email ?? '',
    buildingId: client.buildingId ? String(client.buildingId) : '',
    password: '',
    regenerateQr: false,
  });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm(f => ({ ...f, [key]: value }));

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || 'Erreur lors de la mise à jour.');
        return;
      }
      invalidateJson('/api/clients');
      toast.success('Client mis à jour.');
      onDone();
    } catch {
      setError('Erreur de connexion.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
      )}
      <form
        onSubmit={e => { e.preventDefault(); setConfirmOpen(true); }}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        <div className="space-y-1.5">
          <Label htmlFor="edit-login">Identifiant (login) *</Label>
          <Input id="edit-login" maxLength={LIMITS.login} required value={form.login} onChange={e => set('login', e.target.value)} className={FIELD} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-name">Nom complet</Label>
          <Input id="edit-name" maxLength={LIMITS.name} value={form.name} onChange={e => set('name', e.target.value)} className={FIELD} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-building">Immeuble</Label>
          <select
            id="edit-building"
            value={form.buildingId}
            onChange={e => set('buildingId', e.target.value)}
            className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">— Sélectionner un immeuble —</option>
            {(buildings ?? []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-unit">Numéro d&apos;unité *</Label>
          <Input id="edit-unit" maxLength={LIMITS.unitNumber} required value={form.unitNumber} onChange={e => set('unitNumber', e.target.value)} className={FIELD} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-phone">Téléphone</Label>
          <Input id="edit-phone" maxLength={LIMITS.phone} type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} className={FIELD} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-email">Email</Label>
          <Input id="edit-email" maxLength={LIMITS.email} type="email" value={form.email} onChange={e => set('email', e.target.value)} className={FIELD} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="edit-password">Nouveau mot de passe temporaire</Label>
          <Input
            id="edit-password" maxLength={LIMITS.password}
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={e => set('password', e.target.value)}
            placeholder="Laisser vide pour ne pas changer"
            className={FIELD}
          />
          <p className="text-xs text-muted-foreground">Le résident devra choisir son propre mot de passe à la prochaine connexion.</p>
        </div>
        <div className="flex items-center gap-2.5 sm:col-span-2">
          <button
            type="button"
            id="edit-regenerate-qr"
            role="checkbox"
            aria-checked={form.regenerateQr}
            onClick={() => set('regenerateQr', !form.regenerateQr)}
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
              form.regenerateQr ? 'border-primary bg-primary' : 'border-border bg-muted'
            }`}
          >
            {form.regenerateQr && <RefreshCw className="h-3 w-3 text-primary-foreground" />}
          </button>
          <Label htmlFor="edit-regenerate-qr" className="cursor-pointer">
            Régénérer le code QR (l&apos;ancien ne fonctionnera plus)
          </Label>
        </div>
        <Button type="submit" disabled={saving} className="sm:col-span-2">
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </form>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enregistrer les modifications ?</AlertDialogTitle>
            <AlertDialogDescription>
              La fiche de « {clientLabel(client)} » sera mise à jour.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={save}>Enregistrer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function ClientEditDialog({ client, onClose, onSaved }: {
  client: ClientBase | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <Dialog open={client !== null} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Modifier le client</DialogTitle>
        </DialogHeader>
        {client && (
          <EditForm
            key={client.id}
            client={client}
            onDone={() => { onSaved(); onClose(); }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
