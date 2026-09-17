'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { StatusBadge } from '@/components/ui/status-badge';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useJson } from '@/hooks/useJson';
import { SEARCH_MAX_LENGTH, SEARCH_MIN_LENGTH, normalizeQuery } from '@/lib/client-search';
import { cn } from '@/lib/utils';
import type { SearchResponse } from '@/components/admin/clients/types';
import { clientLabel, homeLabel, initials } from '@/components/admin/clients/format';

type Result = {
  key: string;
  href: string;
  group: 'clients' | 'issues';
  render: (query: string) => React.ReactNode;
};

const noop = () => () => {};
function useIsMac() {
  return useSyncExternalStore(noop, () => /Mac|iPhone|iPad/.test(navigator.platform), () => false);
}

export function ShortcutHint({ className }: { className?: string }) {
  const mac = useIsMac();
  return (
    <kbd className={cn('rounded border border-border bg-background px-1.5 font-mono text-[10px] text-muted-foreground', className)}>
      {mac ? '⌘K' : 'Ctrl K'}
    </kbd>
  );
}

function Highlight({ text, query }: { text: string; query: string }) {
  const at = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded-sm bg-warning-wash px-0.5 font-semibold text-warning">{text.slice(at, at + query.length)}</mark>
      {text.slice(at + query.length)}
    </>
  );
}

function toResults(data: SearchResponse): Result[] {
  return [
    ...data.clients.map((c): Result => ({
      key: `c${c.id}`,
      href: `/admin/clients/${c.id}`,
      group: 'clients',
      render: q => (
        <>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-accent-foreground">
            {initials(clientLabel(c))}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium"><Highlight text={clientLabel(c)} query={q} /></span>
            <span className="truncate text-xs text-muted-foreground">
              <Highlight text={[homeLabel(c), c.phone].filter(Boolean).join(' · ')} query={q} />
            </span>
          </span>
        </>
      ),
    })),
    ...data.issues.map((i): Result => ({
      key: `i${i.id}`,
      href: `/admin/issues/${i.id}`,
      group: 'issues',
      render: q => (
        <>
          <span className="w-9 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">#{i.id}</span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium">
              {i.description ? <Highlight text={i.description} query={q} /> : <span className="italic text-muted-foreground">Sans description</span>}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              <Highlight text={[clientLabel(i.client), i.client.unitNumber && `Apt ${i.client.unitNumber}`].filter(Boolean).join(' · ')} query={q} />
            </span>
          </span>
          <StatusBadge status={i.status} />
        </>
      ),
    })),
  ];
}

const GROUP_LABELS = { clients: 'Clients', issues: 'Réclamations' } as const;

// Mounted only while open, so every opening starts with an empty box.
function SearchBody({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [active, setActive] = useState(0);
  const query = useDebouncedValue(normalizeQuery(text), 200);
  const ready = query.length >= SEARCH_MIN_LENGTH;
  const { data, error, loading } = useJson<SearchResponse>(
    ready ? `/api/search?q=${encodeURIComponent(query)}` : null,
    { keepPrevious: true },
  );

  const results = ready && data ? toResults(data) : [];
  const current = Math.min(active, results.length - 1);
  const matched = data?.query ?? query;

  const go = (href: string) => {
    onDone();
    router.push(href);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!results.length) return;
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((Math.max(current, 0) + step + results.length) % results.length);
    } else if (e.key === 'Enter' && current >= 0) {
      e.preventDefault();
      go(results[current].href);
    }
  };

  let status: React.ReactNode = null;
  if (normalizeQuery(text).length < SEARCH_MIN_LENGTH) {
    status = 'Nom, téléphone, email, appartement, immeuble ou numéro de réclamation.';
  } else if (error && !results.length) {
    status = <span className="text-destructive">{error.message}</span>;
  } else if (!data || (loading && !results.length)) {
    status = 'Recherche…';
  } else if (!results.length) {
    status = `Aucun résultat pour « ${matched} ».`;
  }

  return (
    <>
      <div className="flex items-center gap-3 border-b border-border px-4">
        {loading && ready
          ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground motion-reduce:animate-none" aria-hidden />
          : <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
        <input
          autoFocus
          type="text"
          role="combobox"
          aria-label="Rechercher"
          aria-expanded={results.length > 0}
          aria-controls="command-results"
          aria-autocomplete="list"
          aria-activedescendant={current >= 0 ? `command-option-${results[current].key}` : undefined}
          value={text}
          onChange={e => { setText(e.target.value); setActive(0); }}
          onKeyDown={onKeyDown}
          placeholder="Rechercher un client ou une réclamation…"
          autoComplete="off"
          spellCheck={false}
          maxLength={SEARCH_MAX_LENGTH}
          className="h-12 min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
        />
        <kbd className="hidden rounded border border-border px-1.5 font-mono text-[10px] text-muted-foreground sm:inline">Échap</kbd>
      </div>

      <div className="max-h-[min(60dvh,26rem)] overflow-y-auto">
        {status ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground" aria-live="polite">{status}</p>
        ) : (
          <ul id="command-results" role="listbox" aria-label="Résultats" className={cn('p-2 transition-opacity', loading && 'opacity-60')}>
            {results.map((r, i) => (
              <li key={r.key} role="presentation">
                {(i === 0 || results[i - 1].group !== r.group) && (
                  <p role="presentation" className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {GROUP_LABELS[r.group]}
                  </p>
                )}
                <Link
                  id={`command-option-${r.key}`}
                  href={r.href}
                  prefetch={false}
                  role="option"
                  aria-selected={i === current}
                  tabIndex={-1}
                  onMouseMove={() => { if (i !== current) setActive(i); }}
                  onClick={onDone}
                  ref={i === current ? el => el?.scrollIntoView({ block: 'nearest' }) : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-2 py-2 text-foreground',
                    i === current && 'bg-accent text-accent-foreground',
                  )}
                >
                  {r.render(matched)}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="hidden gap-4 border-t border-border bg-muted/40 px-4 py-2 text-[11px] text-muted-foreground sm:flex">
        <span><kbd className="font-mono">↑ ↓</kbd> naviguer</span>
        <span><kbd className="font-mono">Entrée</kbd> ouvrir</span>
        <span><kbd className="font-mono">Échap</kbd> fermer</span>
      </div>
    </>
  );
}

export function CommandSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  // Ctrl+K / Cmd+K from any admin page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-[10dvh] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl"
      >
        <DialogTitle className="sr-only">Recherche rapide</DialogTitle>
        <DialogDescription className="sr-only">Trouver un client ou une réclamation.</DialogDescription>
        {open && <SearchBody onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

export function SearchTrigger({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-9 w-full items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm text-muted-foreground transition-colors hover:border-input hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring',
        className,
      )}
    >
      <Search className="h-4 w-4 shrink-0" />
      <span className="flex-1 text-left">Rechercher…</span>
      <ShortcutHint />
    </button>
  );
}
