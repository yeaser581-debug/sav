'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, MapPin, User, Search, X, CalendarDays, List, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Visit = {
  id: number;
  scheduledAt: string;
  status: string;
  issue: {
    id: number;
    originalDescription: string;
    status: string;
    severity: string | null;
    client: { unitNumber: string; name: string; phone: string | null };
  };
};

const STATUS_META: Record<string, { label: string; dot: string; block: string }> = {
  PROPOSED: { label: 'Proposé', dot: 'bg-amber-500', block: 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-400' },
  CONFIRMED: { label: 'Confirmé', dot: 'bg-blue-500', block: 'bg-blue-500/15 border-blue-500/40 text-blue-700 dark:text-blue-400' },
  DECLINED: { label: 'Refusé', dot: 'bg-rose-500', block: 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400' },
  CANCELLED: { label: 'Annulé', dot: 'bg-slate-400', block: 'bg-muted border-border text-muted-foreground' },
  DONE: { label: 'Terminé', dot: 'bg-emerald-500', block: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-400' },
};

const SEVERITY_META: Record<string, { label: string; color: string; text: string }> = {
  CRITICAL: { label: 'Urgent', color: 'border-l-red-500', text: 'text-red-600 dark:text-red-400' },
  MEDIUM: { label: 'Moyen', color: 'border-l-orange-400', text: 'text-orange-600 dark:text-orange-400' },
  LOW: { label: 'Faible', color: 'border-l-slate-300 dark:border-l-slate-600', text: 'text-muted-foreground' },
};

const START_HOUR = 8;
const END_HOUR = 19;
const ROW_HEIGHT = 56;

function startOfWeek(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function isSameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

function toDateInputValue(d: Date) {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

// Default visual duration used only for collision layout (visits have no real end time).
const SLOT_HOURS = 1;

type LaidOutVisit = { visit: Visit; start: number; col: number; cols: number };

// Lays visits that overlap in time out side-by-side (like Google Calendar's day view)
// instead of letting them stack fully on top of each other.
function layoutDayVisits(dayVisits: Visit[]): LaidOutVisit[] {
  const items = dayVisits
    .map(visit => {
      const d = new Date(visit.scheduledAt);
      const start = d.getHours() + d.getMinutes() / 60;
      return { visit, start, end: start + SLOT_HOURS };
    })
    .sort((a, b) => a.start - b.start);

  const clusters: (typeof items)[] = [];
  let current: typeof items = [];
  let clusterEnd = -Infinity;
  for (const item of items) {
    if (current.length === 0 || item.start < clusterEnd) {
      current.push(item);
      clusterEnd = Math.max(clusterEnd, item.end);
    } else {
      clusters.push(current);
      current = [item];
      clusterEnd = item.end;
    }
  }
  if (current.length) clusters.push(current);

  const result: LaidOutVisit[] = [];
  for (const cluster of clusters) {
    const columnEnds: number[] = [];
    const placements: { item: (typeof cluster)[number]; col: number }[] = [];
    for (const item of cluster) {
      let col = columnEnds.findIndex(end => end <= item.start);
      if (col === -1) {
        col = columnEnds.length;
        columnEnds.push(item.end);
      } else {
        columnEnds[col] = item.end;
      }
      placements.push({ item, col });
    }
    const cols = columnEnds.length;
    for (const p of placements) {
      result.push({ visit: p.item.visit, start: p.item.start, col: p.col, cols });
    }
  }
  return result;
}

export default function AgentVisitsPage() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'week' | 'list'>('week');
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [search, setSearch] = useState('');
  const [hiddenStatuses, setHiddenStatuses] = useState<Set<string>>(new Set());
  const [hiddenSeverities, setHiddenSeverities] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    fetch('/api/visits')
      .then(res => res.json())
      .then(data => {
        setVisits(Array.isArray(data) ? data : []);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    }),
    [weekStart]
  );

  const hours = useMemo(
    () => Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i),
    []
  );

  const statusesInUse = Array.from(new Set(visits.map(v => v.status)));
  const severitiesInUse = Array.from(new Set(visits.map(v => v.issue.severity).filter(Boolean))) as string[];

  const toggleStatus = (s: string) => {
    setHiddenStatuses(prev => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  };
  const toggleSeverity = (s: string) => {
    setHiddenSeverities(prev => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  };

  const matchesSearch = (v: Visit) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      v.issue.client.name.toLowerCase().includes(q) ||
      v.issue.client.unitNumber.toLowerCase().includes(q) ||
      String(v.issue.id).includes(q) ||
      v.issue.originalDescription?.toLowerCase().includes(q)
    );
  };

  const filteredVisits = visits.filter(v =>
    !hiddenStatuses.has(v.status) &&
    !(v.issue.severity && hiddenSeverities.has(v.issue.severity)) &&
    matchesSearch(v)
  );

  const filtersActive = search.trim() !== '' || hiddenStatuses.size > 0 || hiddenSeverities.size > 0;
  const resetFilters = () => { setSearch(''); setHiddenStatuses(new Set()); setHiddenSeverities(new Set()); };

  const goToday = () => { setWeekStart(startOfWeek(new Date())); setSelectedDate(new Date()); };
  const goPrevWeek = () => {
    setWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; });
    setSelectedDate(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; });
  };
  const goNextWeek = () => {
    setWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; });
    setSelectedDate(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; });
  };
  const goPrevDay = () => {
    const n = new Date(selectedDate);
    n.setDate(n.getDate() - 1);
    setSelectedDate(n);
    setWeekStart(startOfWeek(n));
  };
  const goNextDay = () => {
    const n = new Date(selectedDate);
    n.setDate(n.getDate() + 1);
    setSelectedDate(n);
    setWeekStart(startOfWeek(n));
  };

  const rangeLabel = (() => {
    const first = weekDays[0];
    const last = weekDays[6];
    const sameMonth = first.getMonth() === last.getMonth();
    const firstStr = first.toLocaleDateString('fr-FR', sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'short' });
    const lastStr = last.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${firstStr} - ${lastStr}`;
  })();

  const nowOffset = (now.getHours() + now.getMinutes() / 60 - START_HOUR) * ROW_HEIGHT;
  const showNowLine = now.getHours() >= START_HOUR && now.getHours() < END_HOUR;

  const sortedList = [...filteredVisits].sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  const upcomingList = sortedList.filter(v => new Date(v.scheduledAt) > now);
  const pastList = sortedList.filter(v => new Date(v.scheduledAt) <= now).reverse();

  const FilterChips = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-0.5">Statut</span>
        {statusesInUse.map(s => {
          const meta = STATUS_META[s] ?? { label: s, dot: 'bg-muted-foreground' };
          const hidden = hiddenStatuses.has(s);
          return (
            <button
              key={s}
              onClick={() => toggleStatus(s)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold transition-opacity border-border ${hidden ? 'opacity-40' : ''}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
              {meta.label}
            </button>
          );
        })}
      </div>
      {severitiesInUse.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-0.5">Gravité</span>
          {severitiesInUse.map(s => {
            const meta = SEVERITY_META[s] ?? { label: s, color: 'border-l-muted-foreground', text: 'text-muted-foreground' };
            const hidden = hiddenSeverities.has(s);
            return (
              <button
                key={s}
                onClick={() => toggleSeverity(s)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border text-[11px] font-semibold transition-opacity ${hidden ? 'opacity-40' : ''}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${meta.text.replace('text-', 'bg-')}`} />
                {meta.label}
              </button>
            );
          })}
        </div>
      )}
      {filtersActive && (
        <Button variant="ghost" size="sm" onClick={resetFilters} className="h-6 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground">
          <RotateCcw className="h-3 w-3" /> Réinitialiser
        </Button>
      )}
    </div>
  );

  const VisitListCard = ({ visit, dimmed }: { visit: Visit; dimmed?: boolean }) => {
    const d = new Date(visit.scheduledAt);
    const statusMeta = STATUS_META[visit.status] ?? STATUS_META.PROPOSED;
    const sevMeta = visit.issue.severity ? SEVERITY_META[visit.issue.severity] : null;
    return (
      <Link
        href={`/agent/issues/${visit.issue.id}`}
        className={`block rounded-xl border border-border bg-card hover:border-foreground/20 transition-all overflow-hidden border-l-4 ${sevMeta?.color ?? 'border-l-border'} ${dimmed ? 'opacity-70' : ''}`}
      >
        <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-foreground">
                {d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="text-[10px] font-mono font-bold text-muted-foreground">#{visit.issue.id}</span>
              <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-border ${statusMeta.dot.replace('bg-', 'text-')}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dot}`} />
                {statusMeta.label}
              </span>
              {sevMeta && <span className={`text-[10px] font-semibold ${sevMeta.text}`}>{sevMeta.label}</span>}
            </div>
            <p className="text-sm font-semibold text-foreground flex items-center gap-1.5 truncate">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              Unité {visit.issue.client.unitNumber}
              <span className="text-muted-foreground font-normal flex items-center gap-1">
                <User className="h-3 w-3" /> {visit.issue.client.name}
              </span>
            </p>
            <p className="text-xs text-muted-foreground truncate max-w-xl">{visit.issue.originalDescription}</p>
          </div>
        </div>
      </Link>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Planning des visites</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {filteredVisits.length} visite{filteredVisits.length !== 1 ? 's' : ''} {filtersActive ? 'correspondante(s)' : 'planifiée(s)'}.
          </p>
        </div>
        <div className="flex items-center gap-1 p-1 bg-muted rounded-lg border border-border">
          <Button
            onClick={() => setView('week')}
            variant={view === 'week' ? 'default' : 'ghost'}
            size="sm"
            className={`h-7 gap-1.5 text-xs ${view === 'week' ? '' : 'text-muted-foreground'}`}
          >
            <CalendarDays className="h-3.5 w-3.5" /> Semaine
          </Button>
          <Button
            onClick={() => setView('list')}
            variant={view === 'list' ? 'default' : 'ghost'}
            size="sm"
            className={`h-7 gap-1.5 text-xs ${view === 'list' ? '' : 'text-muted-foreground'}`}
          >
            <List className="h-3.5 w-3.5" /> Liste
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un résident, une unité, un ticket..."
          className="pl-9 pr-8 h-9"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {!loading && FilterChips}

      {loading ? (
        <div className="flex justify-center py-20">
          <svg className="animate-spin h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : view === 'week' ? (
        <>
        <div className="hidden md:block bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-border">
            <Button onClick={goToday} variant="outline" size="sm" className="h-8 text-xs font-semibold border-border">
              Aujourd&apos;hui
            </Button>
            <div className="flex items-center gap-0.5">
              <Button onClick={goPrevWeek} variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-foreground">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button onClick={goNextWeek} variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-foreground">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <h2 className="text-sm font-bold text-foreground capitalize">{rangeLabel}</h2>
            <input
              type="date"
              value={toDateInputValue(weekStart)}
              onChange={e => e.target.value && setWeekStart(startOfWeek(new Date(e.target.value)))}
              className="text-xs text-muted-foreground bg-transparent border border-border rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Aller à une date"
            />
          </div>

          {/* Day headers */}
          <div className="flex border-b border-border">
            <div className="w-14 shrink-0" />
            {weekDays.map(day => {
              const today = isSameDay(day, now);
              return (
                <div key={day.toISOString()} className={`flex-1 min-w-[110px] text-center py-2.5 border-l border-border ${today ? 'bg-accent/60' : ''}`}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {day.toLocaleDateString('fr-FR', { weekday: 'short' })}
                  </p>
                  <p className={`text-sm font-bold mt-0.5 ${today ? 'text-foreground' : 'text-foreground/80'}`}>{day.getDate()}</p>
                </div>
              );
            })}
          </div>

          {/* Grid */}
          <div className="flex overflow-x-auto">
            <div className="w-14 shrink-0">
              {hours.map(h => (
                <div key={h} style={{ height: ROW_HEIGHT }} className="relative">
                  <span className="absolute -top-2 right-2 text-[10px] font-medium text-muted-foreground">
                    {String(h).padStart(2, '0')}:00
                  </span>
                </div>
              ))}
            </div>

            {weekDays.map(day => {
              const dayVisits = filteredVisits.filter(v => isSameDay(new Date(v.scheduledAt), day));
              const today = isSameDay(day, now);
              return (
                <div key={day.toISOString()} className="flex-1 min-w-[110px] border-l border-border relative">
                  {hours.map(h => <div key={h} style={{ height: ROW_HEIGHT }} className="border-t border-border/60" />)}

                  {today && showNowLine && (
                    <div className="absolute left-0 right-0 flex items-center z-10 pointer-events-none" style={{ top: nowOffset }}>
                      <div className="h-1.5 w-1.5 rounded-full bg-red-500 -ml-0.5" />
                      <div className="h-px flex-1 bg-red-500" />
                    </div>
                  )}

                  {layoutDayVisits(dayVisits).map(({ visit, start, col, cols }) => {
                    if (start < START_HOUR || start >= END_HOUR) return null;
                    const top = (start - START_HOUR) * ROW_HEIGHT;
                    const meta = STATUS_META[visit.status] ?? STATUS_META.PROPOSED;
                    const sevMeta = visit.issue.severity ? SEVERITY_META[visit.issue.severity] : null;
                    const gap = 3;
                    const widthPct = 100 / cols;
                    return (
                      <Link
                        key={visit.id}
                        href={`/agent/issues/${visit.issue.id}`}
                        style={{
                          top: top + 2,
                          height: ROW_HEIGHT - 4,
                          left: `calc(${col * widthPct}% + ${col === 0 ? 4 : gap / 2}px)`,
                          width: `calc(${widthPct}% - ${cols === 1 ? 8 : gap + (col === 0 || col === cols - 1 ? gap / 2 : 0)}px)`,
                          zIndex: 10 + col,
                        }}
                        className={`absolute rounded-lg border border-l-4 px-2 py-1 text-[11px] leading-tight overflow-hidden hover:brightness-95 hover:z-20 transition-all ${meta.block} ${sevMeta?.color ?? ''}`}
                      >
                        <p className="font-bold truncate flex items-center gap-1">
                          <MapPin className="h-2.5 w-2.5 shrink-0" />
                          Unité {visit.issue.client.unitNumber}
                        </p>
                        {cols < 3 && (
                        <p className="truncate opacity-80 flex items-center gap-1">
                          <User className="h-2.5 w-2.5 shrink-0" />
                          {visit.issue.client.name}
                        </p>
                        )}
                        <p className="text-[10px] font-semibold opacity-70">
                          {new Date(visit.scheduledAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Mobile: single-day agenda — a 7-column hour grid doesn't fit a phone screen */}
        <div className="md:hidden bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border">
            <Button onClick={goToday} variant="outline" size="sm" className="h-8 text-xs font-semibold border-border shrink-0">
              Aujourd&apos;hui
            </Button>
            <div className="flex items-center gap-1">
              <Button onClick={goPrevDay} variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-foreground">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs font-bold text-foreground capitalize min-w-[96px] text-center">
                {selectedDate.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
              </span>
              <Button onClick={goNextDay} variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-foreground">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Day strip */}
          <div className="flex gap-1.5 px-3 py-2.5 overflow-x-auto border-b border-border">
            {weekDays.map(day => {
              const selected = isSameDay(day, selectedDate);
              const today = isSameDay(day, now);
              const dayVisitCount = filteredVisits.filter(v => isSameDay(new Date(v.scheduledAt), day)).length;
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDate(day)}
                  className={`flex flex-col items-center justify-center shrink-0 w-12 h-14 rounded-xl border transition-colors ${
                    selected ? 'bg-foreground text-background border-foreground' : today ? 'bg-accent border-border' : 'border-border text-foreground'
                  }`}
                >
                  <span className={`text-[9px] font-bold uppercase ${selected ? 'text-background/70' : 'text-muted-foreground'}`}>
                    {day.toLocaleDateString('fr-FR', { weekday: 'short' })}
                  </span>
                  <span className="text-sm font-bold">{day.getDate()}</span>
                  {dayVisitCount > 0 && (
                    <span className={`h-1 w-1 rounded-full mt-0.5 ${selected ? 'bg-background' : 'bg-foreground'}`} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Agenda for the selected day */}
          <div className="p-3 space-y-2.5">
            {(() => {
              const dayVisits = filteredVisits
                .filter(v => isSameDay(new Date(v.scheduledAt), selectedDate))
                .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
              if (dayVisits.length === 0) {
                return (
                  <div className="text-center py-10 text-xs text-muted-foreground font-semibold">
                    Aucune visite ce jour-là{filtersActive ? ' pour ces filtres' : ''}.
                  </div>
                );
              }
              return dayVisits.map(v => <VisitListCard key={v.id} visit={v} />);
            })()}
          </div>
        </div>
        </>
      ) : (
        <div className="space-y-8">
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-foreground">À venir ({upcomingList.length})</h2>
            {upcomingList.length === 0 ? (
              <div className="rounded-xl border border-border text-center py-10 text-xs text-muted-foreground font-semibold">
                Aucune visite à venir{filtersActive ? ' pour ces filtres' : ''}.
              </div>
            ) : (
              <div className="space-y-2.5">
                {upcomingList.map(v => <VisitListCard key={v.id} visit={v} />)}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-bold text-muted-foreground">Passées ({pastList.length})</h2>
            {pastList.length === 0 ? (
              <div className="rounded-xl border border-border text-center py-10 text-xs text-muted-foreground font-semibold opacity-70">
                Aucun historique{filtersActive ? ' pour ces filtres' : ''}.
              </div>
            ) : (
              <div className="space-y-2.5">
                {pastList.map(v => <VisitListCard key={v.id} visit={v} dimmed />)}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
