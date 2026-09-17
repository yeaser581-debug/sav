'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Building2, CalendarDays, HardHat, Mail, MapPin, Pencil, Phone, QrCode, Trash2, UserX,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { invalidateJson, useJson } from '@/hooks/useJson';
import { cn } from '@/lib/utils';
import type { ClientProfileResponse } from './types';
import { clientLabel, formatDay, formatDuration, homeLabel, initials } from './format';
import { ClientHistory } from './ClientHistory';
import { ClientQrDialog } from './ClientQrDialog';
import { ClientEditDialog } from './ClientEditDialog';
import { AccountBadge } from './AccountBadge';

function Fact({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0" /> {label}
      </dt>
      <dd className="break-words text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}

function Tally({ value, label, tone, className }: { value: React.ReactNode; label: string; tone?: 'warning' | 'success'; className?: string }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-0.5 bg-card px-4 py-3', className)}>
      <span className={cn(
        'text-2xl font-bold leading-tight tabular-nums',
        tone === 'warning' && 'text-warning',
        tone === 'success' && 'text-success',
      )}>
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-48 w-full rounded-lg" />
      <Skeleton className="h-16 w-full rounded-lg" />
      <Skeleton className="h-72 w-full rounded-lg" />
    </div>
  );
}

const BACK = (
  <Link href="/admin/clients" className="inline-flex w-fit items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
    <ArrowLeft className="h-3.5 w-3.5" /> Clients
  </Link>
);

export function ClientProfileView({ clientId }: { clientId: number }) {
  const router = useRouter();
  const { data, error, reload } = useJson<ClientProfileResponse>(`/api/clients/${clientId}`);
  const [qrOpen, setQrOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (error && !data) {
    return (
      <div className="space-y-6">
        {BACK}
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card px-6 py-16 text-center">
          <UserX className="h-10 w-10 text-muted-foreground opacity-50" />
          <p className="font-medium text-foreground">{error.status === 404 ? 'Client introuvable' : error.message}</p>
          <p className="text-sm text-muted-foreground">
            {error.status === 404 ? 'Il a peut-être été supprimé. Les clients supprimés se restaurent depuis la corbeille.' : 'Réessayez dans un instant.'}
          </p>
          <Link href="/admin/clients" className={buttonVariants({ variant: 'outline', size: 'sm' })}>Retour aux clients</Link>
        </div>
      </div>
    );
  }

  if (!data) return <ProfileSkeleton />;

  const { client, stats } = data;
  const label = clientLabel(client);
  const area = client.building?.area;

  const remove = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/clients/${client.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error || 'Erreur lors de la suppression.');
        return;
      }
      invalidateJson('/api/clients');
      toast.success(`« ${label} » a été déplacé dans la corbeille.`);
      router.push('/admin/clients');
    } catch {
      toast.error('Erreur de connexion.');
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="space-y-4 pb-12">
      {BACK}

      <section className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-base font-bold text-accent-foreground">
            {initials(label)}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-bold tracking-tight text-foreground">{label}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono">{client.login}</span>
              <AccountBadge activated={!client.mustSetPassword} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setQrOpen(true)} className="gap-1.5">
              <QrCode className="h-3.5 w-3.5" /> Code QR
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="gap-1.5">
              <Pencil className="h-3.5 w-3.5" /> Modifier
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmDelete(true)}
              className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" /> Supprimer
            </Button>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-4 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <Fact icon={Phone} label="Téléphone">
            {client.phone
              ? <a href={`tel:${client.phone.replace(/[^\d+]/g, '')}`} className="font-mono tabular-nums hover:underline">{client.phone}</a>
              : <span className="text-muted-foreground">—</span>}
          </Fact>
          <Fact icon={Mail} label="Email">
            {client.email
              ? <a href={`mailto:${client.email}`} className="hover:underline">{client.email}</a>
              : <span className="text-muted-foreground">—</span>}
          </Fact>
          <Fact icon={Building2} label="Logement">{homeLabel(client)}</Fact>
          <Fact icon={HardHat} label="Zone et agent">
            {!client.building
              ? <span className="text-muted-foreground">—</span>
              : area
                ? <>{area.name} · {area.agent?.name ?? <span className="text-warning">aucun agent</span>}</>
                : <span className="text-warning">Immeuble sans zone</span>}
          </Fact>
          <Fact icon={MapPin} label="Adresse de l’immeuble">{client.building?.address || '—'}</Fact>
          <Fact icon={CalendarDays} label="Client depuis">{formatDay(client.createdAt)}</Fact>
          <Fact icon={QrCode} label="Code QR">
            {client.qrUsedAt ? `Utilisé le ${formatDay(client.qrUsedAt)}` : 'Pas encore utilisé'}
          </Fact>
        </dl>
      </section>

      <section aria-label="Résumé des réclamations" className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-5">
        <Tally value={stats.total} label="Réclamations" />
        <Tally value={stats.open} label="Ouvertes" tone={stats.open ? 'warning' : undefined} />
        <Tally value={stats.resolved} label="Résolues" tone={stats.resolved ? 'success' : undefined} />
        <Tally value={stats.disputed} label="Contestées" tone={stats.disputed ? 'warning' : undefined} />
        <Tally value={formatDuration(stats.avgResolutionHours)} label="Délai moyen de résolution" className="col-span-2 sm:col-span-1" />
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <h2 className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">Historique des réclamations</h2>
        <ClientHistory clientId={client.id} stats={stats} />
      </section>

      <ClientQrDialog clientId={client.id} label={label} open={qrOpen} onOpenChange={setQrOpen} />
      <ClientEditDialog client={editing ? client : null} onClose={() => setEditing(false)} onSaved={reload} />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer « {label} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le résident ne pourra plus se connecter. Sa fiche et ses réclamations restent récupérables depuis la corbeille.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={remove} disabled={deleting}>
              {deleting ? 'Suppression…' : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
