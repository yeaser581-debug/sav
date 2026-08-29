'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import { SeverityBadge } from '@/components/ui/severity-badge';
import { PaginationControls } from '@/components/ui/pagination';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { Search, Plus, Calendar, ArrowRight, ClipboardList } from 'lucide-react';

type Issue = {
  id: number;
  originalDescription: string;
  status: string;
  severity: string;
  createdAt: string;
  agent?: { name: string } | null;
};

type FilterKey = 'ALL' | 'PENDING' | 'IN_PROGRESS' | 'RESOLVED';
const VALID_FILTERS: FilterKey[] = ['ALL', 'PENDING', 'IN_PROGRESS', 'RESOLVED'];

type Counts = { ALL: number; PENDING: number; IN_PROGRESS: number; RESOLVED: number };
const DEFAULT_COUNTS: Counts = { ALL: 0, PENDING: 0, IN_PROGRESS: 0, RESOLVED: 0 };
const LIMIT = 20;

export default function ClientIssuesPage() {
  return (
    <Suspense fallback={null}>
      <ClientIssuesPageInner />
    </Suspense>
  );
}

function ClientIssuesPageInner() {
  const searchParams = useSearchParams();
  const initialTab = (VALID_FILTERS as string[]).includes(searchParams.get('filter') || '')
    ? (searchParams.get('filter') as FilterKey)
    : 'ALL';

  const [issues, setIssues] = useState<Issue[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Counts>(DEFAULT_COUNTS);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<FilterKey>(initialTab);
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, activeTab]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(LIMIT));
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (activeTab !== 'ALL') params.set('filter', activeTab);

    setRefetching(true);
    fetch(`/api/issues?${params.toString()}`, { signal: controller.signal })
      .then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(data => {
        setIssues(Array.isArray(data.issues) ? data.issues : []);
        setTotal(data.total || 0);
        setCounts(data.counts || DEFAULT_COUNTS);
        setInitialLoading(false);
        setRefetching(false);
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setError('Erreur lors du chargement des réclamations.');
        setInitialLoading(false);
        setRefetching(false);
      });

    return () => controller.abort();
  }, [page, debouncedSearch, activeTab]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Mes réclamations</h1>
          <p className="text-muted-foreground mt-1 text-sm">Suivez l'état et l'avancement de vos demandes d'intervention.</p>
        </div>
        <Link href="/client/issues/new" passHref>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium px-5 py-2.5 rounded-lg flex items-center gap-2 shadow-lg shadow-primary/10 transition-all active:scale-95 shrink-0">
            <Plus className="h-4 w-4" />
            Nouvelle réclamation
          </Button>
        </Link>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-card border border-border rounded-xl p-3">
        {/* Tabs */}
        <div className="flex bg-muted border border-border rounded-lg p-1 w-full md:w-auto">
          {[
            { id: 'ALL', label: 'Toutes', count: counts.ALL },
            { id: 'PENDING', label: 'Ouvertes', count: counts.PENDING },
            { id: 'IN_PROGRESS', label: 'En cours', count: counts.IN_PROGRESS },
            { id: 'RESOLVED', label: 'Résolues', count: counts.RESOLVED },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as FilterKey)}
              className={`flex-1 md:flex-none px-4 py-1.5 rounded-md text-xs font-semibold tracking-wide transition-all ${
                activeTab === tab.id
                  ? 'bg-accent text-foreground shadow-sm border border-border'
                  : 'text-muted-foreground hover:text-foreground border border-transparent'
              }`}
            >
              {tab.label} <span className="ml-1 text-[10px] bg-background px-1.5 py-0.5 rounded-full border border-border">{tab.count}</span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher une réclamation..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 bg-muted border-border text-foreground placeholder-muted-foreground h-9 rounded-lg"
          />
        </div>
      </div>

      {/* Issues Grid / List */}
      {initialLoading ? (
        <div className="flex justify-center py-16">
          <svg className="animate-spin h-8 w-8 text-foreground" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : error ? (
        <Card className="border-destructive/30 bg-destructive/5 text-center p-8 text-destructive">
          <p className="font-semibold">{error}</p>
        </Card>
      ) : issues.length === 0 ? (
        <Card className="bg-card border-border text-center py-16">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4 border border-border">
            <ClipboardList className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-1">Aucune réclamation</h3>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-6">
            {searchQuery
              ? 'Aucune réclamation ne correspond à votre recherche.'
              : "Vous n'avez pas de demande d'intervention active dans cette catégorie."}
          </p>
          {!searchQuery && (
            <Link href="/client/issues/new" passHref>
              <Button className="bg-muted hover:bg-accent text-foreground border border-border rounded-lg text-xs font-semibold px-4 py-2">
                Créer ma première réclamation
              </Button>
            </Link>
          )}
        </Card>
      ) : (
        <div className={refetching ? 'opacity-60 transition-opacity space-y-4' : 'transition-opacity space-y-4'}>
        <div className="grid grid-cols-1 gap-4">
          {issues.map(issue => {
            return (
              <Card key={issue.id} className="bg-card border-border hover:border-foreground/20 transition-all duration-150 group">
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex-1 space-y-4">
                      {/* Badge / Info top */}
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="font-mono text-xs font-bold text-muted-foreground">#{issue.id}</span>
                        <StatusBadge status={issue.status} />
                        {issue.severity && issue.severity !== 'NORMAL' && (
                          <SeverityBadge severity={issue.severity} />
                        )}
                        <span className="text-xs text-muted-foreground flex items-center gap-1 ml-auto lg:ml-0">
                          <Calendar className="h-3.5 w-3.5" />
                          {new Date(issue.createdAt).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </span>
                      </div>

                      {/* Description */}
                      <h3 className="text-foreground font-semibold leading-relaxed transition-colors line-clamp-1">
                        {issue.originalDescription}
                      </h3>
                    </div>

                    {/* Right side CTA / Agent */}
                    <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between lg:justify-center gap-4 border-t lg:border-t-0 lg:border-l border-border pt-4 lg:pt-0 lg:pl-6 shrink-0">
                      {issue.agent ? (
                        <div className="text-left lg:text-right">
                          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Technicien</p>
                          <p className="text-sm font-semibold text-foreground flex items-center gap-1.5 mt-0.5">
                            <span className="w-2 h-2 rounded-full bg-foreground shrink-0" />
                            {issue.agent.name}
                          </p>
                        </div>
                      ) : (
                        <div className="text-left lg:text-right">
                          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Technicien</p>
                          <p className="text-xs text-muted-foreground italic mt-0.5">En attente d'assignation</p>
                        </div>
                      )}

                      <Link href={`/client/issues/${issue.id}`} passHref>
                        <Button variant="ghost" className="h-9 px-4 rounded-lg bg-muted text-foreground hover:bg-accent border border-border hover:border-foreground/20 font-medium flex items-center gap-1.5 transition-all text-xs group/btn active:scale-95">
                          Suivre
                          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/btn:translate-x-0.5" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <PaginationControls page={page} total={total} limit={LIMIT} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
