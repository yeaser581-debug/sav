'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FileSpreadsheet, Home, Loader2, Pencil, Plus, QrCode, Search, Trash2, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { PaginationControls } from '@/components/ui/pagination';
import { showUndoToast } from '@/components/ui/undo-toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { invalidateJson, useJson } from '@/hooks/useJson';
import { CLIENT_PAGE_SIZE, SEARCH_MAX_LENGTH, normalizeQuery } from '@/lib/client-search';
import { cn } from '@/lib/utils';
import type { ClientListResponse, ClientRow } from '@/components/admin/clients/types';
import { clientLabel, formatDay, homeLabel, initials, plural } from '@/components/admin/clients/format';
import { AccountBadge } from '@/components/admin/clients/AccountBadge';
import { ClientQrDialog } from '@/components/admin/clients/ClientQrDialog';
import { ClientEditDialog } from '@/components/admin/clients/ClientEditDialog';
import { LIMITS } from '@/lib/limits';

type Building = { id: number; name: string };

const EMPTY_FORM = { login: '', password: '', name: '', unitNumber: '', phone: '', email: '', buildingId: '' };
const FIELD = 'bg-muted border-border text-foreground placeholder:text-muted-foreground';
const COLUMNS = 'md:grid-cols-[minmax(0,1.5fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_9rem_auto]';

function CreateClientForm({ onCreated }: { onCreated: (client: { id: number; label: string }) => void }) {
  const { data: buildings } = useJson<Building[]>('/api/buildings');
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const set = (key: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || 'Erreur lors de la création.');
        return;
      }
      setForm(EMPTY_FORM);
      onCreated({ id: body.client.id, label: clientLabel(body.client) });
    } catch {
      setError('Erreur de connexion.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="border-border bg-card shadow-sm">
      <CardHeader className="border-b border-border px-6 py-5">
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Home className="h-4 w-4" /> Créer un compte client
        </CardTitle>
        <CardDescription className="mt-0.5 text-xs text-muted-foreground">
          Son code QR de connexion s’affiche dès la création.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-6 py-5">
        {error && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
        )}
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="new-login">Identifiant (login) *</Label>
            <Input id="new-login" maxLength={LIMITS.login} required value={form.login} onChange={set('login')} placeholder="resident-A101" className={FIELD} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-password">Mot de passe temporaire *</Label>
            <Input id="new-password" maxLength={LIMITS.password} required type="password" autoComplete="new-password" value={form.password} onChange={set('password')} placeholder="••••••••" className={FIELD} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-unit">Numéro d&apos;unité *</Label>
            <Input id="new-unit" maxLength={LIMITS.unitNumber} required value={form.unitNumber} onChange={set('unitNumber')} placeholder="A101" className={FIELD} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-building">Immeuble *</Label>
            <select
              id="new-building"
              required
              value={form.buildingId}
              onChange={set('buildingId')}
              className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">— Sélectionner un immeuble —</option>
              {(buildings ?? []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-name">Nom complet</Label>
            <Input id="new-name" maxLength={LIMITS.name} value={form.name} onChange={set('name')} placeholder="Fatima Benali" className={FIELD} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-phone">Téléphone</Label>
            <Input id="new-phone" maxLength={LIMITS.phone} type="tel" value={form.phone} onChange={set('phone')} placeholder="+212 6XX XX XX XX" className={FIELD} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-email">Email</Label>
            <Input id="new-email" maxLength={LIMITS.email} type="email" value={form.email} onChange={set('email')} placeholder="client@example.com" className={FIELD} />
          </div>
          <div className="pt-2 md:col-span-2">
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? 'Création en cours…' : 'Créer le client'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function ClaimsCell({ claims }: { claims: ClientRow['claims'] }) {
  if (claims.total === 0) return <span className="text-xs text-muted-foreground">Aucune réclamation</span>;
  return (
    <span className="flex flex-col gap-1">
      <span className="flex flex-wrap items-center gap-1.5 text-xs">
        {claims.open > 0 && (
          <span className="rounded-full bg-warning-wash px-2 py-0.5 font-semibold text-warning tabular-nums">
            {plural(claims.open, 'ouverte', 'ouvertes')}
          </span>
        )}
        <span className="text-muted-foreground tabular-nums">{claims.total} au total</span>
      </span>
      <span className="text-[11px] text-muted-foreground">Dernière le {formatDay(claims.lastAt)}</span>
    </span>
  );
}

function ClientRowItem({ client, onQr, onEdit, onDelete }: {
  client: ClientRow;
  onQr: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const label = clientLabel(client);
  return (
    <li className={cn('relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-muted/50', COLUMNS)}>
      <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
          {initials(label)}
        </span>
        <div className="min-w-0">
          {/* The whole row opens the client; the action buttons sit above this link. */}
          <Link
            href={`/admin/clients/${client.id}`}
            className="block truncate text-sm font-semibold text-foreground after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset"
          >
            {label}
          </Link>
          <span className="mt-0.5 flex flex-wrap items-center gap-2">
            <span className="truncate font-mono text-[11px] text-muted-foreground">{client.login}</span>
            {client.mustSetPassword && <AccountBadge activated={false} />}
          </span>
        </div>
      </div>

      <div className="relative z-10 col-start-2 row-start-1 flex items-center gap-0.5 justify-self-end md:col-start-5">
        <IconButton icon={QrCode} onClick={onQr} label={`Code QR de ${label}`} />
        <IconButton icon={Pencil} onClick={onEdit} label={`Modifier ${label}`} />
        <IconButton icon={Trash2} onClick={onDelete} variant="destructive" label={`Supprimer ${label}`} />
      </div>

      <div className="col-span-2 row-start-2 flex min-w-0 flex-wrap gap-x-6 gap-y-2 pl-12 md:contents">
        <span className="min-w-0 text-sm text-foreground md:col-start-2 md:row-start-1 md:truncate">{homeLabel(client)}</span>
        <span className="flex min-w-0 flex-col text-xs text-muted-foreground md:col-start-3 md:row-start-1">
          {client.phone && <span className="truncate font-mono tabular-nums text-foreground">{client.phone}</span>}
          {client.email && <span className="truncate">{client.email}</span>}
          {!client.phone && !client.email && <span>—</span>}
        </span>
        <span className="md:col-start-4 md:row-start-1"><ClaimsCell claims={client.claims} /></span>
      </div>
    </li>
  );
}

function ClientsDirectory() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlQuery = normalizeQuery(searchParams.get('q'));
  const page = Math.max(1, Number(searchParams.get('page')) || 1);

  // What the box shows. It follows the URL when the URL changes from outside
  // (back button), but not while the admin is typing ahead of it.
  const [text, setText] = useState(urlQuery);
  const [expectedQuery, setExpectedQuery] = useState(urlQuery);
  if (urlQuery !== expectedQuery) {
    setExpectedQuery(urlQuery);
    setText(urlQuery);
  }

  const typingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(typingTimer.current), []);

  const navigate = (q: string, nextPage: number) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (nextPage > 1) params.set('page', String(nextPage));
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const onType = (value: string) => {
    setText(value);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      const next = normalizeQuery(value);
      if (next === urlQuery) return;
      setExpectedQuery(next);
      navigate(next, 1);
    }, 300);
  };

  const listUrl = `/api/clients?${new URLSearchParams({ q: urlQuery, page: String(page), limit: String(CLIENT_PAGE_SIZE) })}`;
  const { data, error, loading, reload } = useJson<ClientListResponse>(listUrl, { keepPrevious: true });

  const [showForm, setShowForm] = useState(false);
  const [qrFor, setQrFor] = useState<{ id: number; label: string } | null>(null);
  const [editing, setEditing] = useState<ClientRow | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set());
  const deleteTimers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const { confirm, confirmDialog } = useConfirm();

  const refresh = () => {
    invalidateJson('/api/clients');
    reload();
  };

  const unhide = (id: number) => setHiddenIds(prev => {
    const next = new Set(prev);
    next.delete(id);
    return next;
  });

  const askRemove = (client: ClientRow) => {
    confirm({
      title: `Supprimer « ${clientLabel(client)} » ?`,
      description: 'Le résident ne pourra plus se connecter. Sa fiche et ses réclamations restent récupérables depuis la corbeille.',
      onConfirm: () => remove(client),
    });
  };

  const remove = (client: ClientRow) => {
    setHiddenIds(prev => new Set(prev).add(client.id));
    showUndoToast({
      message: `Client « ${clientLabel(client)} » supprimé`,
      duration: 5000,
      onUndo: () => {
        clearTimeout(deleteTimers.current.get(client.id));
        deleteTimers.current.delete(client.id);
        unhide(client.id);
      },
    });
    deleteTimers.current.set(client.id, setTimeout(async () => {
      deleteTimers.current.delete(client.id);
      try {
        const res = await fetch(`/api/clients/${client.id}`, { method: 'DELETE' });
        if (res.ok) {
          refresh();
        } else {
          const body = await res.json().catch(() => ({}));
          toast.error(body.error || 'Erreur lors de la suppression.');
          unhide(client.id);
        }
      } catch {
        toast.error('Erreur de connexion.');
        unhide(client.id);
      }
    }, 5000));
  };

  const clients = (data?.clients ?? []).filter(c => !hiddenIds.has(c.id));
  const total = data?.total ?? 0;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="mb-1 flex items-center gap-2">
            <div className="h-5 w-1 rounded-full bg-foreground" />
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Administration</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Clients</h1>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {!data
              ? 'Chargement…'
              : urlQuery
                ? `${plural(total, 'résultat', 'résultats')} pour « ${urlQuery} »`
                : `${plural(total, 'résident enregistré', 'résidents enregistrés')}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
        <Link href="/admin/clients/import" className={buttonVariants({ variant: 'outline', className: 'gap-2' })}>
          <FileSpreadsheet className="h-4 w-4" /> Importer un fichier
        </Link>
        <Button
          onClick={() => setShowForm(s => !s)}
          variant={showForm ? 'outline' : 'default'}
          className="gap-2"
        >
          {showForm ? <><X className="h-4 w-4" /> Annuler</> : <><Plus className="h-4 w-4" /> Nouveau client</>}
        </Button>
        </div>
      </div>

      {showForm && (
        <CreateClientForm
          onCreated={created => {
            setShowForm(false);
            toast.success('Client créé.');
            refresh();
            setQrFor(created);
          }}
        />
      )}

      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Label htmlFor="client-search" className="sr-only">Rechercher un client</Label>
        <Input
          id="client-search"
          type="search"
          value={text}
          onChange={e => onType(e.target.value)}
          placeholder="Nom, téléphone, email, login, appartement ou immeuble"
          autoComplete="off"
          maxLength={SEARCH_MAX_LENGTH}
          className="h-10 bg-card pl-9 pr-9"
        />
        {loading && data && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground motion-reduce:animate-none" aria-hidden />
        )}
      </div>

      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className={cn('hidden gap-x-4 border-b border-border px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground md:grid', COLUMNS)}>
          <span>Client</span><span>Logement</span><span>Contact</span><span>Réclamations</span><span className="sr-only">Actions</span>
        </div>

        {error && !data ? (
          <p className="px-4 py-12 text-center text-sm text-destructive">{error.message}</p>
        ) : !data ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : clients.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center text-muted-foreground">
            <Users className="h-10 w-10 opacity-40" />
            {urlQuery ? (
              <>
                <p className="text-sm font-medium">Aucun client ne correspond à « {urlQuery} ».</p>
                <p className="text-xs">Essayez une partie du nom, le numéro d’appartement ou le téléphone sans espaces.</p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium">Aucun client enregistré.</p>
                <p className="text-xs">Créez le premier résident avec « Nouveau client ».</p>
              </>
            )}
          </div>
        ) : (
          <ul aria-busy={loading} className={cn('divide-y divide-border transition-opacity', loading && 'opacity-60')}>
            {clients.map(client => (
              <ClientRowItem
                key={client.id}
                client={client}
                onQr={() => setQrFor({ id: client.id, label: clientLabel(client) })}
                onEdit={() => setEditing(client)}
                onDelete={() => askRemove(client)}
              />
            ))}
          </ul>
        )}

        {data && (
          <div className="border-t border-border px-3 empty:hidden">
            <PaginationControls
              page={page}
              total={total}
              limit={CLIENT_PAGE_SIZE}
              onPageChange={p => navigate(urlQuery, p)}
            />
          </div>
        )}
      </section>

      <ClientQrDialog
        clientId={qrFor?.id ?? null}
        label={qrFor?.label ?? ''}
        open={qrFor !== null}
        onOpenChange={open => { if (!open) setQrFor(null); }}
      />
      <ClientEditDialog client={editing} onClose={() => setEditing(null)} onSaved={refresh} />

      {confirmDialog}
    </div>
  );
}

export default function AdminClientsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
      <ClientsDirectory />
    </Suspense>
  );
}
