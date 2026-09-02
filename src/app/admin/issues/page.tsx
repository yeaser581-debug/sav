'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { IssueTable } from '@/components/issues/IssueTable';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { AlertTriangle, Search, CheckCircle2, PlayCircle } from 'lucide-react';

type Issue = {
  id: number;
  originalDescription: string;
  status: string;
  severity: string;
  createdAt: string;
  client: { unitNumber: string; name?: string };
  latestMessage?: { message: string; mediaType?: string | null; senderType?: string; createdAt: string } | null;
};

type Counts = { total: number; urgent: number; inProgress: number; resolved: number };
const DEFAULT_COUNTS: Counts = { total: 0, urgent: 0, inProgress: 0, resolved: 0 };
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

export default function AdminIssuesPage() {
  return (
    <Suspense fallback={null}>
      <AdminIssuesPageInner />
    </Suspense>
  );
}

function AdminIssuesPageInner() {
  const searchParams = useSearchParams();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Counts>(DEFAULT_COUNTS);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebouncedValue(search, 300);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, severityFilter]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(LIMIT));
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (severityFilter !== 'all') params.set('severity', severityFilter);

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
  }, [page, debouncedSearch, statusFilter, severityFilter]);

  const stats = counts;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-5 w-1 rounded-full bg-foreground" />
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Administration
          </span>
        </div>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">
          Supervision des réclamations
        </h1>
        <p className="text-muted-foreground text-sm">Vue globale de toutes les interventions — triées par priorité.</p>
      </div>

      {/* Mini stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: 'Total', value: stats.total, icon: AlertTriangle, color: 'text-muted-foreground', bg: 'bg-muted',
            active: statusFilter === 'all' && severityFilter === 'all',
            onClick: () => { setStatusFilter('all'); setSeverityFilter('all'); },
          },
          {
            label: 'Urgentes', value: stats.urgent, icon: AlertTriangle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/10',
            active: severityFilter === 'CRITICAL',
            onClick: () => { setStatusFilter('all'); setSeverityFilter('CRITICAL'); },
          },
          {
            label: 'En cours', value: stats.inProgress, icon: PlayCircle, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-500/10',
            active: statusFilter === 'IN_PROGRESS',
            onClick: () => { setStatusFilter('IN_PROGRESS'); setSeverityFilter('all'); },
          },
          {
            label: 'Résolues', value: stats.resolved, icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10',
            active: statusFilter === 'RESOLVED',
            onClick: () => { setStatusFilter('RESOLVED'); setSeverityFilter('all'); },
          },
        ].map(s => {
          const clickable = s.value > 0;
          const card = (
            <Card className={`bg-card border-border shadow-sm transition-all duration-200 ${clickable ? `hover:shadow-md hover:-translate-y-0.5 cursor-pointer ${s.active ? 'ring-2 ring-primary/50 border-primary/40' : ''}` : 'opacity-60'}`}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`h-9 w-9 rounded-lg ${s.bg} flex items-center justify-center shrink-0`}>
                  <s.icon className={`h-4 w-4 ${s.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground leading-none">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          );

          if (!clickable) {
            return <div key={s.label}>{card}</div>;
          }

          return (
            <button key={s.label} type="button" onClick={s.onClick} className="text-left">
              {card}
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <Card className="bg-card border-border shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par ID ou description..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 bg-muted border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <Select value={statusFilter} onValueChange={(val: string | null) => setStatusFilter(val || 'all')}>
              <SelectTrigger className="w-full md:w-44 bg-muted border-border text-foreground">
                <SelectValue placeholder="Statut">
                  {(value: string | null) => value ? (STATUS_SELECT_LABELS[value] ?? value) : 'Statut'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="all">Tous statuts</SelectItem>
                <SelectItem value="PENDING_AGENT">En attente</SelectItem>
                <SelectItem value="IN_PROGRESS">En cours</SelectItem>
                <SelectItem value="RESOLVED">Résolue</SelectItem>
                <SelectItem value="CONFIRMED">Confirmée</SelectItem>
                <SelectItem value="REJECTED">Rejetée</SelectItem>
                <SelectItem value="DISPUTED">Contestée</SelectItem>
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={(val: string | null) => setSeverityFilter(val || 'all')}>
              <SelectTrigger className="w-full md:w-44 bg-muted border-border text-foreground">
                <SelectValue placeholder="Sévérité">
                  {(value: string | null) => value ? (SEVERITY_SELECT_LABELS[value] ?? value) : 'Sévérité'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="all">Toute sévérité</SelectItem>
                <SelectItem value="CRITICAL">Urgent</SelectItem>
                <SelectItem value="MEDIUM">Moyen</SelectItem>
                <SelectItem value="LOW">Faible</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="bg-card border-border shadow-sm overflow-hidden">
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {total} réclamation{total !== 1 ? 's' : ''}
          </CardTitle>
        </CardHeader>
        {initialLoading ? (
          <CardContent className="p-4 space-y-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full bg-muted" />)}
          </CardContent>
        ) : (
          <div className={refetching ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
            <IssueTable
              issues={issues}
              basePath="/admin/issues"
              variant="conversation"
              emptyMessage="Aucune réclamation trouvée."
            />
            <PaginationControls page={page} total={total} limit={LIMIT} onPageChange={setPage} />
          </div>
        )}
      </Card>
    </div>
  );
}
