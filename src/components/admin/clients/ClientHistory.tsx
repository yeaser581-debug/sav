'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Inbox, Mic, Paperclip } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import { SeverityBadge } from '@/components/ui/severity-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PaginationControls } from '@/components/ui/pagination';
import { useJson } from '@/hooks/useJson';
import { cn } from '@/lib/utils';
import { HISTORY_PAGE_SIZE } from '@/lib/client-search';
import type { ClaimStats, HistoryFilter, HistoryIssue, HistoryResponse } from './types';
import { formatDay } from './format';

const FILTERS: { value: HistoryFilter; label: string; count: (s: ClaimStats) => number }[] = [
  { value: 'all', label: 'Toutes', count: s => s.total },
  { value: 'open', label: 'Ouvertes', count: s => s.open },
  { value: 'resolved', label: 'Résolues', count: s => s.resolved },
  { value: 'disputed', label: 'Contestées', count: s => s.disputed },
  { value: 'rejected', label: 'Rejetées', count: s => s.rejected },
];

const EMPTY: Record<HistoryFilter, string> = {
  all: 'Aucune réclamation pour ce client.',
  open: 'Aucune réclamation ouverte.',
  resolved: 'Aucune réclamation résolue.',
  disputed: 'Aucune réclamation contestée.',
  rejected: 'Aucune réclamation rejetée.',
};

function lastMessageText(m: NonNullable<HistoryIssue['lastMessage']>) {
  if (m.message) return m.message;
  return m.mediaType === 'AUDIO' ? 'Message vocal' : 'Pièce jointe';
}

function Row({ issue, current, compact }: { issue: HistoryIssue; current: boolean; compact: boolean }) {
  const m = issue.lastMessage;
  const MediaIcon = m && !m.message ? (m.mediaType === 'AUDIO' ? Mic : Paperclip) : null;

  return (
    <li>
      <Link
        href={`/admin/issues/${issue.id}`}
        aria-current={current ? 'page' : undefined}
        className={cn(
          'group grid items-center gap-x-3 gap-y-1 px-4 py-3 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none',
          compact ? 'grid-cols-[auto_minmax(0,1fr)]' : 'grid-cols-[3rem_minmax(0,1fr)_auto] sm:grid-cols-[3rem_minmax(0,1fr)_8.5rem_6.5rem_1rem]',
          current && 'bg-accent/60 hover:bg-accent/80',
        )}
      >
        <span className="font-mono text-xs tabular-nums text-muted-foreground">#{issue.id}</span>

        <span className="flex min-w-0 flex-col gap-1">
          <span className={cn('truncate font-medium text-foreground', compact ? 'text-xs' : 'text-sm')}>
            {issue.description || <span className="italic text-muted-foreground">Sans description</span>}
          </span>
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {compact && <StatusBadge status={issue.status} />}
            {issue.severity && <SeverityBadge severity={issue.severity} />}
            {!compact && (
              <span className="shrink-0">
                {issue.agent?.name ?? (issue.status === 'PENDING_AGENT' ? 'Pas encore assignée' : 'Sans agent')}
              </span>
            )}
            {!compact && m && (
              <span className="flex min-w-0 items-center gap-1">
                <span aria-hidden>·</span>
                {MediaIcon && <MediaIcon className="h-3 w-3 shrink-0" />}
                <span className="truncate italic">{lastMessageText(m)}</span>
              </span>
            )}
            {compact && <span className="tabular-nums">{formatDay(issue.createdAt, false)}</span>}
            {current && <span className="font-semibold text-accent-foreground">Réclamation affichée</span>}
          </span>
        </span>

        {!compact && (
          <>
            <span className="justify-self-end sm:justify-self-start"><StatusBadge status={issue.status} /></span>
            <span className="col-span-2 col-start-2 text-xs tabular-nums text-muted-foreground sm:col-span-1 sm:col-start-auto sm:text-right">
              {formatDay(issue.createdAt)}
            </span>
            <ChevronRight className="hidden h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 sm:block" />
          </>
        )}
      </Link>
    </li>
  );
}

/**
 * A client's claims, newest first. The full version filters by status and
 * pages; the compact one (inbox panel) shows the latest few.
 */
export function ClientHistory({ clientId, stats, compact = false, pageSize = HISTORY_PAGE_SIZE, currentIssueId }: {
  clientId: number;
  stats?: ClaimStats;
  compact?: boolean;
  pageSize?: number;
  currentIssueId?: number;
}) {
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [page, setPage] = useState(1);
  const url = `/api/clients/${clientId}/issues?status=${filter}&page=${page}&limit=${pageSize}`;
  const { data, error, loading } = useJson<HistoryResponse>(url, { keepPrevious: true });

  const choose = (next: HistoryFilter) => {
    setFilter(next);
    setPage(1);
  };

  const visibleFilters = stats
    ? FILTERS.filter(f => f.value === 'all' || f.value === filter || f.count(stats) > 0)
    : [];

  return (
    <div>
      {!compact && visibleFilters.length > 1 && (
        <div role="tablist" aria-label="Filtrer par statut" className="flex gap-1 overflow-x-auto border-b border-border px-4 py-2">
          {visibleFilters.map(f => (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={filter === f.value}
              onClick={() => choose(f.value)}
              className={cn(
                'shrink-0 rounded-md px-2.5 py-1 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-ring',
                filter === f.value
                  ? 'bg-accent font-semibold text-accent-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {f.label}
              {stats && <span className="ml-1.5 tabular-nums opacity-70">{f.count(stats)}</span>}
            </button>
          ))}
        </div>
      )}

      {error && !data ? (
        <p className="px-4 py-8 text-center text-sm text-destructive">{error.message}</p>
      ) : !data ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: compact ? 3 : 4 }, (_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : data.issues.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-muted-foreground">
          <Inbox className="h-8 w-8 opacity-40" />
          <p className="text-sm">{EMPTY[filter]}</p>
        </div>
      ) : (
        <ul
          aria-busy={loading}
          className={cn('divide-y divide-border transition-opacity', loading && 'opacity-60')}
        >
          {data.issues.map(issue => (
            <Row key={issue.id} issue={issue} current={issue.id === currentIssueId} compact={compact} />
          ))}
        </ul>
      )}

      {!compact && data && (
        <div className="border-t border-border px-3 empty:hidden">
          <PaginationControls page={page} total={data.total} limit={pageSize} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
