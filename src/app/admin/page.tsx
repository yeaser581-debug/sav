import Link from 'next/link';
import { AlertTriangle, ArrowRight, ChevronRight, Inbox, MessageSquare, RotateCcw, TrendingDown, TrendingUp } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { TriageWidget } from '@/components/admin/issues/TriageWidget';
import { ActivityChart } from '@/components/admin/dashboard/ActivityChart';
import { OpenClaimsChart } from '@/components/admin/dashboard/OpenClaimsChart';
import { getDashboard } from '@/lib/dashboard-data';
import { formatHours } from '@/lib/dashboard';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const TONES = {
  danger: 'bg-destructive-wash text-destructive',
  warn: 'bg-warning-wash text-warning',
  calm: 'bg-neutral-wash text-neutral',
} as const;

/** One thing that needs doing, with the count and where to do it. */
function ActionTile({ count, label, href, icon: Icon, tone, urgent = false }: {
  count: number;
  label: string;
  href: string;
  icon: React.ElementType;
  tone: keyof typeof TONES;
  urgent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 rounded-lg border bg-card px-3.5 py-3 transition-colors hover:bg-muted/40',
        // Only the row that is actually late gets an outline; if everything is
        // outlined, nothing stands out.
        urgent && count > 0 ? 'border-destructive/40' : 'border-border',
      )}
    >
      <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg', TONES[tone])}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className={cn('block text-xl font-bold leading-tight tabular-nums', urgent && count > 0 && 'text-destructive')}>
          {count}
        </span>
        <span className="block truncate text-xs text-muted-foreground">{label}</span>
      </span>
      <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

function Delta({ value, suffix = ' %', goodWhenUp }: { value: number | null; suffix?: string; goodWhenUp: boolean }) {
  if (value === null) return <span className="text-[11px] text-muted-foreground">Pas de comparaison</span>;
  if (value === 0) return <span className="text-[11px] text-muted-foreground">Stable</span>;

  const up = value > 0;
  const good = up === goodWhenUp;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px] font-semibold', good ? 'text-success' : 'text-destructive')}>
      <Icon className="h-3 w-3" />
      {up ? '+' : '−'}{Math.abs(value).toString().replace('.', ',')}{suffix}
    </span>
  );
}

/** A change in delay, written in the same units as the value above it. */
function HoursDelta({ value }: { value: number | null }) {
  if (value === null) return <span className="text-[11px] text-muted-foreground">Pas de comparaison</span>;
  if (Math.abs(value) < 0.5) return <span className="text-[11px] text-muted-foreground">Stable</span>;

  const faster = value < 0;
  const Icon = faster ? TrendingDown : TrendingUp;
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px] font-semibold', faster ? 'text-success' : 'text-destructive')}>
      <Icon className="h-3 w-3" />
      {faster ? '−' : '+'}{formatHours(Math.abs(value))}
    </span>
  );
}

function Kpi({ label, value, unit, children }: { label: string; value: string; unit?: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold leading-tight tracking-tight tabular-nums">
        {value}{unit && <span className="text-sm font-semibold text-muted-foreground">{unit}</span>}
      </p>
      {children}
    </div>
  );
}

export default async function AdminDashboard() {
  const { actions, openTotal, openByStatus, oldest, period, weeks, conversations } = await getDashboard();

  return (
    <div className="flex flex-col gap-4 pb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Administration</span>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-foreground">Tableau de bord</h1>
          <p className="text-[13px] text-muted-foreground">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            {' · '}
            {openTotal === 0 ? 'aucune réclamation ouverte' : `${openTotal} réclamation${openTotal > 1 ? 's' : ''} ouverte${openTotal > 1 ? 's' : ''}`}
          </p>
        </div>
        <Link href="/admin/issues" className={buttonVariants({ className: 'gap-2 shadow-sm' })}>
          Voir toutes les réclamations <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ActionTile count={actions.late} label="En retard sur le délai" href="/admin/issues?filter=late" icon={AlertTriangle} tone="danger" urgent />
        <ActionTile count={actions.unassigned} label="À attribuer à un agent" href="/admin/issues?status=PENDING_AGENT" icon={Inbox} tone="warn" />
        <ActionTile count={actions.disputed} label="Résolution contestée" href="/admin/issues?status=DISPUTED" icon={RotateCcw} tone="warn" />
        <ActionTile count={actions.unanswered} label="Sans réponse depuis 24 h" href="/admin/issues?filter=unanswered" icon={MessageSquare} tone="calm" />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.6fr_1fr]">
        <section className="rounded-lg border border-border bg-card">
          <header className="flex flex-wrap items-start justify-between gap-2 px-4 pt-3">
            <div>
              <h2 className="text-sm font-semibold">Activité · 30 derniers jours</h2>
              <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                Le stock grossit quand les créations passent au-dessus des résolutions.
              </p>
            </div>
            <div className="flex items-center gap-3.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <i className="h-2.5 w-2.5 rounded-sm bg-(--chart-created)" aria-hidden /> Créées
              </span>
              <span className="flex items-center gap-1.5">
                <i className="h-2.5 w-2.5 rounded-sm bg-(--chart-resolved)" aria-hidden /> Résolues
              </span>
            </div>
          </header>

          <div className="flex flex-wrap gap-x-7 gap-y-3 px-4 pt-3">
            <Kpi label="Nouvelles" value={String(period.created)}>
              <Delta value={period.createdChange} goodWhenUp={false} />
            </Kpi>
            <Kpi label="Résolues" value={String(period.resolved)}>
              <Delta value={period.resolvedChange} goodWhenUp />
            </Kpi>
            <Kpi label="Délai moyen" value={formatHours(period.averageHours)}>
              <HoursDelta value={period.averageHoursChange} />
            </Kpi>
            <Kpi label="Délais respectés" value={period.sla === null ? '—' : String(period.sla)} unit={period.sla === null ? undefined : ' %'}>
              {period.slaTotal > 0
                ? <span className="text-[11px] text-muted-foreground">{period.slaOnTime} sur {period.slaTotal} dans les temps</span>
                : <span className="text-[11px] text-muted-foreground">Rien à mesurer</span>}
            </Kpi>
          </div>

          <div className="px-1 pb-2 pt-1">
            <ActivityChart weeks={weeks} />
          </div>
        </section>

        <section className="flex flex-col rounded-lg border border-border bg-card">
          <header className="px-4 pt-3">
            <h2 className="text-sm font-semibold">Réclamations ouvertes</h2>
            <p className="mt-0.5 text-[11.5px] text-muted-foreground">Par statut, aujourd’hui</p>
          </header>

          <div className="flex flex-1 items-center px-4 py-3">
            {openTotal === 0 ? (
              <p className="w-full py-8 text-center text-sm text-muted-foreground">
                Rien en attente. Tout est traité.
              </p>
            ) : (
              <OpenClaimsChart rows={openByStatus} total={openTotal} />
            )}
          </div>

          {oldest && (
            <p className="mx-4 mb-3 border-t border-border pt-2.5 text-[11.5px] text-muted-foreground">
              Plus ancienne :{' '}
              <Link href={`/admin/issues/${oldest.issue.id}`} className="font-semibold text-foreground hover:underline">
                #{oldest.issue.id}
              </Link>{' '}
              — ouverte depuis {oldest.days} jour{oldest.days > 1 ? 's' : ''}.
            </p>
          )}
        </section>
      </div>

      <section className="rounded-lg border border-border bg-card">
        <header className="flex items-center justify-between gap-3 px-4 py-3">
          <h2 className="text-sm font-semibold">Conversations à traiter</h2>
          <Link href="/admin/issues" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
            Voir {openTotal > 3 ? `les ${openTotal}` : 'tout'} <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </header>
        <TriageWidget issues={conversations} />
      </section>
    </div>
  );
}
