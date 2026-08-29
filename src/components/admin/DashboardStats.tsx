'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  AlertTriangle,
  Clock,
  Users,
  Building2,
  ArrowRight,
  Mail,
  Phone,
  Home,
  ChevronRight,
} from 'lucide-react';

type Agent = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  issueCount: number;
  createdAt: string;
};

type Client = {
  id: number;
  name: string | null;
  unitNumber: string | null;
  login: string;
  phone: string | null;
  email: string | null;
  buildingName: string | null;
  issueCount: number;
  createdAt: string;
};

type PendingIssue = {
  id: number;
  description: string | null;
  unitNumber: string | null;
  severity: string | null;
  createdAt: string;
};

type StatKey = 'total' | 'pending' | 'agents' | 'clients';

const SEVERITY_LABELS: Record<string, string> = { CRITICAL: 'Critique', MEDIUM: 'Moyen', LOW: 'Faible' };
const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-500',
  MEDIUM: 'bg-orange-500',
  LOW: 'bg-zinc-400',
};

function initials(name: string) {
  return name.split(' ').map(w => w[0]?.toUpperCase()).slice(0, 2).join('') || '?';
}

export function DashboardStats({
  totalIssues,
  pendingCount,
  agentCount,
  clientCount,
  severity,
  agents,
  clients,
  pendingIssues,
}: {
  totalIssues: number;
  pendingCount: number;
  agentCount: number;
  clientCount: number;
  severity: { CRITICAL: number; MEDIUM: number; LOW: number };
  agents: Agent[];
  clients: Client[];
  pendingIssues: PendingIssue[];
}) {
  const [open, setOpen] = useState<StatKey | null>(null);

  // "En attente" is the number that actually demands action today, so it gets the
  // hero treatment (bold accent fill) instead of sitting in an identical box next
  // to three reference numbers that don't need the same urgency.
  const secondary: { key: StatKey; title: string; value: number; icon: React.ElementType }[] = [
    { key: 'total', title: 'Total réclamations', value: totalIssues, icon: AlertTriangle },
    { key: 'agents', title: 'Agents actifs', value: agentCount, icon: Users },
    { key: 'clients', title: 'Clients inscrits', value: clientCount, icon: Building2 },
  ];

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-3">
        <button
          type="button"
          onClick={() => setOpen('pending')}
          disabled={pendingCount === 0}
          className={`relative overflow-hidden rounded-2xl bg-primary text-primary-foreground p-6 text-left flex flex-col justify-end min-h-44 shadow-sm transition-all duration-200 ${pendingCount > 0 ? 'hover:shadow-md hover:-translate-y-0.5 cursor-pointer' : 'opacity-60 cursor-default'}`}
        >
          <svg className="absolute inset-0 w-full h-full opacity-[0.14] pointer-events-none" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <pattern id="dash-zellige" width="34" height="34" patternUnits="userSpaceOnUse">
                <rect x="3" y="3" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1" transform="rotate(45 13 13)" />
                <rect x="3" y="3" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dash-zellige)" />
          </svg>
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-xs font-semibold opacity-85 mb-2">
              <Clock className="h-3.5 w-3.5" />
              En attente d&apos;attribution
            </div>
            <div className="text-5xl font-extrabold tracking-tight tabular-nums">{pendingCount}</div>
            <p className="text-xs opacity-80 mt-1.5">
              {pendingCount === 0 ? 'Aucune réclamation en attente' : 'Nécessite une attribution à un agent'}
            </p>
          </div>
        </button>

        <div className="flex flex-col gap-2">
          {secondary.map((stat) => {
            const Icon = stat.icon;
            const clickable = stat.value > 0;
            const row = (
              <div className={`flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 flex-1 shadow-sm transition-all duration-200 ${clickable ? 'hover:shadow-md hover:-translate-y-0.5' : 'opacity-60'}`}>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted shrink-0">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-muted-foreground truncate">{stat.title}</div>
                  <div className="text-lg font-bold text-foreground tabular-nums leading-tight">{stat.value}</div>
                </div>
                {clickable && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
              </div>
            );
            if (!clickable) return <div key={stat.key}>{row}</div>;
            return (
              <button key={stat.key} type="button" onClick={() => setOpen(stat.key)} className="text-left flex">
                {row}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Total réclamations ─────────────────────────────────── */}
      <Sheet open={open === 'total'} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Total réclamations</SheetTitle>
            <SheetDescription>Répartition par degré de sévérité, toutes périodes confondues.</SheetDescription>
          </SheetHeader>
          <div className="px-4 space-y-4 flex-1 overflow-y-auto">
            <div className="text-5xl font-extrabold text-foreground tracking-tight">{totalIssues}</div>
            <Separator />
            <div className="space-y-3">
              {(['CRITICAL', 'MEDIUM', 'LOW'] as const).map((key) => {
                const count = severity[key];
                const pct = totalIssues > 0 ? Math.round((count / totalIssues) * 100) : 0;
                return (
                  <div key={key} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground">{SEVERITY_LABELS[key]}</span>
                      <span className="text-muted-foreground tabular-nums">{count} · {pct}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted">
                      <div className={`h-full rounded-full ${SEVERITY_COLORS[key]} transition-all duration-500`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <SheetFooter>
            <Link
              href="/admin/issues"
              onClick={() => setOpen(null)}
              className={buttonVariants({ className: 'w-full bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5' })}
            >
              Voir toutes les réclamations <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── En attente ─────────────────────────────────────────── */}
      <Sheet open={open === 'pending'} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Réclamations en attente</SheetTitle>
            <SheetDescription>{pendingCount} réclamation{pendingCount !== 1 ? 's' : ''} sans agent assigné.</SheetDescription>
          </SheetHeader>
          <div className="px-4 flex-1 overflow-y-auto space-y-2">
            {pendingIssues.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">Aucune réclamation en attente.</p>
            ) : pendingIssues.map((issue) => (
              <Link
                key={issue.id}
                href={`/admin/issues/${issue.id}`}
                onClick={() => setOpen(null)}
                className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/40 hover:bg-accent p-3 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-[11px] text-muted-foreground">#{issue.id}</span>
                    <span className="text-xs font-semibold text-foreground">Unité {issue.unitNumber ?? '—'}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate max-w-70">
                    {issue.description || <span className="italic">Sans description</span>}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
              </Link>
            ))}
          </div>
          <SheetFooter>
            <Link
              href="/admin/issues?status=PENDING_AGENT"
              onClick={() => setOpen(null)}
              className={buttonVariants({ className: 'w-full bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5' })}
            >
              Voir dans la liste complète <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Agents actifs ──────────────────────────────────────── */}
      <Sheet open={open === 'agents'} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Agents actifs</SheetTitle>
            <SheetDescription>{agentCount} agent{agentCount !== 1 ? 's' : ''} d&apos;intervention sur le terrain.</SheetDescription>
          </SheetHeader>
          <div className="px-4 flex-1 overflow-y-auto space-y-2">
            {agents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">Aucun agent enregistré.</p>
            ) : agents.map((agent) => (
              <div key={agent.id} className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-3">
                <div className="w-10 h-10 rounded-full bg-accent border border-border flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-foreground">{initials(agent.name)}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{agent.name}</p>
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground truncate">
                    <Mail className="h-3 w-3 shrink-0" /> {agent.email}
                  </div>
                  {agent.phone && (
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Phone className="h-3 w-3 shrink-0" /> {agent.phone}
                    </div>
                  )}
                </div>
                <span className="text-[11px] font-semibold bg-muted text-muted-foreground border border-border rounded-full px-2 py-0.5 shrink-0">
                  {agent.issueCount} dossier{agent.issueCount !== 1 ? 's' : ''}
                </span>
              </div>
            ))}
          </div>
          <SheetFooter>
            <Link
              href="/admin/agents"
              onClick={() => setOpen(null)}
              className={buttonVariants({ className: 'w-full bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5' })}
            >
              Gérer les agents <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Clients inscrits ───────────────────────────────────── */}
      <Sheet open={open === 'clients'} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Clients inscrits</SheetTitle>
            <SheetDescription>{clientCount} résident{clientCount !== 1 ? 's' : ''} enregistré{clientCount !== 1 ? 's' : ''}.</SheetDescription>
          </SheetHeader>
          <div className="px-4 flex-1 overflow-y-auto space-y-2">
            {clients.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">Aucun client enregistré.</p>
            ) : clients.map((client) => (
              <div key={client.id} className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-3">
                <div className="w-10 h-10 rounded-full bg-accent border border-border flex items-center justify-center shrink-0">
                  <Home className="h-4 w-4 text-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">
                    Unité {client.unitNumber ?? '—'} {client.buildingName ? `· ${client.buildingName}` : ''}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">{client.name || client.login}</p>
                </div>
                <span className="text-[11px] font-semibold bg-muted text-muted-foreground border border-border rounded-full px-2 py-0.5 shrink-0">
                  {client.issueCount} dossier{client.issueCount !== 1 ? 's' : ''}
                </span>
              </div>
            ))}
          </div>
          <SheetFooter>
            <Link
              href="/admin/clients"
              onClick={() => setOpen(null)}
              className={buttonVariants({ className: 'w-full bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5' })}
            >
              Gérer les clients <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

const STATUS_BREAKDOWN = [
  { label: 'En attente agent', key: 'PENDING_AGENT', color: 'bg-amber-500' },
  { label: 'En cours', key: 'IN_PROGRESS', color: 'bg-indigo-500' },
  { label: 'Résolu', key: 'RESOLVED', color: 'bg-emerald-500' },
  { label: 'Confirmé', key: 'CONFIRMED', color: 'bg-emerald-600' },
  { label: 'Rejeté', key: 'REJECTED', color: 'bg-red-500' },
  { label: 'Contesté', key: 'DISPUTED', color: 'bg-rose-500' },
];

export function StatusBreakdownCard({
  totalIssues,
  statusMap,
}: {
  totalIssues: number;
  statusMap: Record<string, number>;
}) {
  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader className="px-6 py-5 border-b border-border">
        <CardTitle className="text-base font-semibold text-foreground">
          Répartition par statut
        </CardTitle>
        <CardDescription className="text-muted-foreground text-xs mt-0.5">
          Cliquez un statut pour filtrer les réclamations
        </CardDescription>
      </CardHeader>
      <CardContent className="px-3 py-3 space-y-1">
        {STATUS_BREAKDOWN.map((item) => {
          const count = statusMap[item.key] ?? 0;
          const pct = totalIssues > 0 ? Math.round((count / totalIssues) * 100) : 0;
          const clickable = count > 0;

          const row = (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  {item.label}
                  {clickable && <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground tabular-nums">{pct}%</span>
                  <span className="text-xs font-bold text-foreground tabular-nums w-5 text-right">
                    {count}
                  </span>
                </div>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${item.color} transition-all duration-500`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </>
          );

          if (!clickable) {
            return (
              <div key={item.key} className="rounded-lg px-3 py-2.5 space-y-1.5 opacity-50">
                {row}
              </div>
            );
          }

          return (
            <Link
              key={item.key}
              href={`/admin/issues?status=${item.key}`}
              className="block rounded-lg px-3 py-2.5 space-y-1.5 hover:bg-accent transition-colors group"
            >
              {row}
            </Link>
          );
        })}

        <Separator className="my-2" />

        <div className="flex items-center justify-between px-3 pb-1">
          <span className="text-xs font-semibold text-muted-foreground">Total</span>
          <span className="text-sm font-bold text-foreground tabular-nums">{totalIssues}</span>
        </div>
      </CardContent>
    </Card>
  );
}
