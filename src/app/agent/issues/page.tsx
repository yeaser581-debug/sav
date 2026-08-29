'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { IssueTable } from '@/components/issues/IssueTable';
import { PaginationControls } from '@/components/ui/pagination';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { Search } from 'lucide-react';

type Issue = {
  id: number;
  originalDescription: string;
  status: string;
  severity: string;
  createdAt: string;
  client: { unitNumber: string };
};

type FilterKey = 'ALL' | 'UNASSIGNED' | 'IN_PROGRESS' | 'RESOLVED';
const VALID_FILTERS: FilterKey[] = ['ALL', 'UNASSIGNED', 'IN_PROGRESS', 'RESOLVED'];

type Counts = { ALL: number; UNASSIGNED: number; IN_PROGRESS: number; RESOLVED: number };
const DEFAULT_COUNTS: Counts = { ALL: 0, UNASSIGNED: 0, IN_PROGRESS: 0, RESOLVED: 0 };
const LIMIT = 20;

export default function AgentIssuesPage() {
  return (
    <Suspense fallback={null}>
      <AgentIssuesPageInner />
    </Suspense>
  );
}

function AgentIssuesPageInner() {
  const searchParams = useSearchParams();
  const initialFilter = (VALID_FILTERS as string[]).includes(searchParams.get('filter') || '')
    ? (searchParams.get('filter') as FilterKey)
    : 'ALL';

  const [issues, setIssues] = useState<Issue[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Counts>(DEFAULT_COUNTS);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const [filter, setFilter] = useState<FilterKey>(initialFilter);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filter]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(LIMIT));
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (filter !== 'ALL') params.set('filter', filter);

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
  }, [page, debouncedSearch, filter]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Gestion des réclamations</h1>
        <p className="text-muted-foreground mt-1 text-sm">Prenez en charge de nouvelles demandes ou suivez vos chantiers en cours.</p>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-card border border-border rounded-xl p-3 shadow-sm">
        {/* Tab Buttons */}
        <div className="flex bg-muted border border-border rounded-lg p-1 w-full md:w-auto">
          {[
            { id: 'ALL', label: 'Toutes', count: counts.ALL },
            { id: 'UNASSIGNED', label: 'À assigner', count: counts.UNASSIGNED },
            { id: 'IN_PROGRESS', label: 'En cours', count: counts.IN_PROGRESS },
            { id: 'RESOLVED', label: 'Résolues', count: counts.RESOLVED },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as FilterKey)}
              className={`flex-1 md:flex-none px-4 py-1.5 rounded-md text-xs font-semibold tracking-wide transition-all ${
                filter === tab.id
                  ? 'bg-accent text-foreground font-semibold shadow-sm border border-border'
                  : 'text-muted-foreground hover:text-foreground border border-transparent'
              }`}
            >
              {tab.label} <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full border bg-background border-border">{tab.count}</span>
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par ID, logement..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 bg-muted border-border text-foreground placeholder-muted-foreground h-9 rounded-lg"
          />
        </div>
      </div>

      {/* Table Card */}
      {initialLoading ? (
        <div className="flex justify-center py-16">
          <svg className="animate-spin h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : (
        <Card className="bg-card border-border shadow-sm overflow-hidden">
          <div className={refetching ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
            <IssueTable
              issues={issues}
              basePath="/agent/issues"
              showDate
              actionLabel={issue => (issue.status === 'PENDING_AGENT' ? 'Accepter' : 'Gérer')}
              emptyMessage="Il n'y a pas d'intervention correspondant aux critères de recherche actuels."
            />
            <PaginationControls page={page} total={total} limit={LIMIT} onPageChange={setPage} />
          </div>
        </Card>
      )}
    </div>
  );
}
