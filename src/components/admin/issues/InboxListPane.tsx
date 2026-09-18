'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { PaginationControls } from '@/components/ui/pagination';
import { IssueTable, type IssueTableItem } from '@/components/issues/IssueTable';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { Search, X } from 'lucide-react';
import { onIssueRead } from '@/lib/read-state';

type Counts = { total: number; urgent: number; inProgress: number; resolved: number; unread: number };
const DEFAULT_COUNTS: Counts = { total: 0, urgent: 0, inProgress: 0, resolved: 0, unread: 0 };
const LIMIT = 20;

const STATUS_SELECT_LABELS: Record<string, string> = {
  all: 'Tous statuts',
  PENDING_AGENT: 'En attente',
  IN_PROGRESS: 'En cours',
  RESOLVED: 'Résolue',
  CONFIRMED: 'Confirmée',
  REJECTED: 'Rejetée',
  DISPUTED: 'Contestée',
};

const SEVERITY_SELECT_LABELS: Record<string, string> = {
  all: 'Toute sévérité',
  CRITICAL: 'Urgent',
  MEDIUM: 'Moyen',
  LOW: 'Faible',
};

export function InboxListPane({ activeId }: { activeId?: number }) {
  return (
    <Suspense fallback={null}>
      <InboxListPaneInner activeId={activeId} />
    </Suspense>
  );
}

function InboxListPaneInner({ activeId }: { activeId?: number }) {
  const searchParams = useSearchParams();
  const [issues, setIssues] = useState<IssueTableItem[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Counts>(DEFAULT_COUNTS);
  const issuesRef = useRef<IssueTableItem[]>([]);

  useEffect(() => {
    issuesRef.current = issues;
  }, [issues]);

  useEffect(() => onIssueRead((issueId) => {
    if (!issuesRef.current.find(i => i.id === issueId)?.unread) return;
    setIssues(prev => prev.map(i => (i.id === issueId ? { ...i, unread: false } : i)));
    setCounts(c => ({ ...c, unread: Math.max(0, c.unread - 1) }));
  }), []);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [severityFilter, setSeverityFilter] = useState(searchParams.get('severity') || 'all');
  // Set by the dashboard's action tiles; shown as a chip so the shortened list
  // is never a mystery.
  const [special, setSpecial] = useState(() => {
    const value = searchParams.get('filter');
    return value === 'late' || value === 'unanswered' ? value : null;
  });
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebouncedValue(search, 300);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [debouncedSearch, statusFilter, severityFilter, special]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(LIMIT));
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (severityFilter !== 'all') params.set('severity', severityFilter);
    if (special) params.set('filter', special);

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRefetching(true);
    fetch(`/api/issues?${params.toString()}`, { signal: controller.signal })
      .then(res => res.json())
      .then(data => {
        setIssues(Array.isArray(data.issues) ? data.issues : []);
        setTotal(data.total || 0);
        setCounts(data.counts || DEFAULT_COUNTS);
        setInitialLoading(false);
        setRefetching(false);
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setIssues([]);
        setInitialLoading(false);
        setRefetching(false);
      });

    return () => controller.abort();
  }, [page, debouncedSearch, statusFilter, severityFilter, special]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-3 border-b border-border space-y-2 shrink-0">
        <h2 className="text-sm font-bold text-foreground px-1">
          Réclamations {total > 0 && <span className="text-muted-foreground font-normal">· {total}</span>}
          {counts.unread > 0 && <span className="text-primary"> · {counts.unread} non lue{counts.unread > 1 ? 's' : ''}</span>}
        </h2>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs bg-muted border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={(val: string | null) => setStatusFilter(val || 'all')}>
            <SelectTrigger className="flex-1 h-8 text-xs bg-muted border-border text-foreground">
              <SelectValue placeholder="Statut">
                {(value: string | null) => value ? (STATUS_SELECT_LABELS[value] ?? value) : 'Statut'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              {Object.entries(STATUS_SELECT_LABELS).map(([val, label]) => (
                <SelectItem key={val} value={val}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={severityFilter} onValueChange={(val: string | null) => setSeverityFilter(val || 'all')}>
            <SelectTrigger className="flex-1 h-8 text-xs bg-muted border-border text-foreground">
              <SelectValue placeholder="Sévérité">
                {(value: string | null) => value ? (SEVERITY_SELECT_LABELS[value] ?? value) : 'Sévérité'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              {Object.entries(SEVERITY_SELECT_LABELS).map(([val, label]) => (
                <SelectItem key={val} value={val}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {special && (
          <button
            type="button"
            onClick={() => setSpecial(null)}
            className="flex w-fit items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 py-1 pl-2.5 pr-2 text-[11px] font-semibold text-destructive"
          >
            {special === 'late' ? 'En retard sur le délai' : 'Sans réponse depuis 24 h'}
            <X className="h-3 w-3" />
            <span className="sr-only">Retirer ce filtre</span>
          </button>
        )}
      </div>

      <div className={`flex-1 min-h-0 overflow-y-auto ${refetching ? 'opacity-60 transition-opacity' : 'transition-opacity'}`}>
        {initialLoading ? (
          <div className="p-3 space-y-3">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14 w-full bg-muted" />)}
          </div>
        ) : (
          <IssueTable
            issues={issues}
            basePath="/admin/issues"
            variant="conversation"
            activeId={activeId}
            emptyMessage="Aucune réclamation trouvée."
          />
        )}
      </div>

      <div className="shrink-0 border-t border-border">
        <PaginationControls page={page} total={total} limit={LIMIT} onPageChange={setPage} />
      </div>
    </div>
  );
}
