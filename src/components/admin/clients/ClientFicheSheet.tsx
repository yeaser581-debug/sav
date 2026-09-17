'use client';

import Link from 'next/link';
import { ArrowRight, Building2, Mail, Phone } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useJson } from '@/hooks/useJson';
import type { ClientProfileResponse } from './types';
import { clientLabel, formatDay, homeLabel, initials, plural } from './format';
import { AccountBadge } from './AccountBadge';
import { ClientHistory } from './ClientHistory';

const RECENT_CLAIMS = 5;

function Summary({ clientId, currentIssueId }: { clientId: number; currentIssueId?: number }) {
  const { data, error } = useJson<ClientProfileResponse>(`/api/clients/${clientId}`);

  if (error && !data) {
    return <p className="px-4 text-sm text-destructive">{error.status === 404 ? 'Ce client a été supprimé.' : error.message}</p>;
  }
  if (!data) {
    return (
      <div className="space-y-3 px-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const { client, stats } = data;
  const label = clientLabel(client);
  const area = client.building?.area;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <section className="space-y-4 px-4 pb-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground">
            {initials(label)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-foreground">{label}</p>
            <AccountBadge activated={!client.mustSetPassword} />
          </div>
        </div>

        <dl className="grid grid-cols-[1rem_minmax(0,1fr)] gap-x-2.5 gap-y-2 text-sm">
          <dt className="pt-0.5 text-muted-foreground"><Phone className="h-3.5 w-3.5" /><span className="sr-only">Téléphone</span></dt>
          <dd>
            {client.phone
              ? <a href={`tel:${client.phone.replace(/[^\d+]/g, '')}`} className="font-mono tabular-nums hover:underline">{client.phone}</a>
              : <span className="text-muted-foreground">—</span>}
          </dd>
          <dt className="pt-0.5 text-muted-foreground"><Mail className="h-3.5 w-3.5" /><span className="sr-only">Email</span></dt>
          <dd className="break-words">
            {client.email ? <a href={`mailto:${client.email}`} className="hover:underline">{client.email}</a> : <span className="text-muted-foreground">—</span>}
          </dd>
          <dt className="pt-0.5 text-muted-foreground"><Building2 className="h-3.5 w-3.5" /><span className="sr-only">Logement</span></dt>
          <dd>
            {homeLabel(client)}
            <span className="block text-xs text-muted-foreground">
              {[area?.name, area?.agent?.name, `client depuis ${formatDay(client.createdAt)}`].filter(Boolean).join(' · ')}
            </span>
          </dd>
        </dl>

        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{plural(stats.total, 'réclamation', 'réclamations')}</span>
          {stats.open > 0 && <> · <span className="font-semibold text-warning">{plural(stats.open, 'ouverte', 'ouvertes')}</span></>}
          {stats.disputed > 0 && <> · {plural(stats.disputed, 'contestée', 'contestées')}</>}
        </p>
      </section>

      <section className="border-t border-border">
        <h3 className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Réclamations récentes
        </h3>
        <ClientHistory clientId={client.id} compact pageSize={RECENT_CLAIMS} currentIssueId={currentIssueId} />
      </section>

      <div className="mt-auto border-t border-border p-4">
        <Link href={`/admin/clients/${client.id}`} className={buttonVariants({ variant: 'outline', className: 'w-full gap-1.5' })}>
          {stats.total > RECENT_CLAIMS ? `Voir les ${stats.total} réclamations` : 'Ouvrir la fiche complète'}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

// Opens over the conversation, so an admin sees who they are answering and
// what else this resident has reported without leaving the claim.
export function ClientFicheSheet({ clientId, currentIssueId, open, onOpenChange }: {
  clientId: number | null;
  currentIssueId?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-sm">
        <SheetHeader className="p-4">
          <SheetTitle>Fiche client</SheetTitle>
          <SheetDescription className="sr-only">Coordonnées, logement et réclamations du résident.</SheetDescription>
        </SheetHeader>
        {open && clientId !== null && <Summary clientId={clientId} currentIssueId={currentIssueId} />}
      </SheetContent>
    </Sheet>
  );
}
