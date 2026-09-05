import Link from 'next/link';
import { ArrowRight, ClipboardList } from 'lucide-react';
import { SeverityBadge } from '@/components/ui/severity-badge';
import { OverdueTag } from '@/components/ui/overdue-tag';
import { conversationSnippet, unitInitials, type IssueTableItem } from '@/components/issues/IssueTable';
import { timeAgo } from '@/lib/utils';

const AVATAR_CAP = 3;

function AvatarStack({ issues }: { issues: IssueTableItem[] }) {
  const shown = issues.slice(0, AVATAR_CAP);
  const overflow = issues.length - shown.length;
  return (
    <div className="flex items-center shrink-0">
      {shown.map((issue, i) => (
        <div
          key={issue.id}
          style={{ marginLeft: i === 0 ? 0 : -10 }}
          className="w-7.5 h-7.5 rounded-full bg-accent border-2 border-card flex items-center justify-center shrink-0"
        >
          <span className="text-[10px] font-bold text-accent-foreground">{unitInitials(issue.client?.unitNumber)}</span>
        </div>
      ))}
      {overflow > 0 && (
        <div style={{ marginLeft: -10 }} className="w-7.5 h-7.5 rounded-full bg-muted border-2 border-card flex items-center justify-center shrink-0">
          <span className="text-[9px] font-bold text-muted-foreground">+{overflow}</span>
        </div>
      )}
    </div>
  );
}

function Band({ label, tone, issues, linkHref }: { label: string; tone: 'crit' | 'std'; issues: IssueTableItem[]; linkHref: string }) {
  const units = issues.slice(0, 3).map(i => `Unité ${i.client?.unitNumber || '—'}`).join(', ');
  const unitsOverflow = issues.length - 3;
  const summary = issues.map(conversationSnippet).join(' · ');

  return (
    <Link href={linkHref} className="block -mx-1 px-1 py-1.5 rounded-lg hover:bg-accent/40 transition-colors">
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-[11px] font-bold uppercase tracking-wider ${tone === 'crit' ? 'text-destructive' : 'text-muted-foreground'}`}>
          {label}
        </span>
        <span className="text-[11px] font-mono font-semibold text-muted-foreground ml-auto">
          {issues.length} en attente
        </span>
      </div>
      <div className="flex items-center gap-2.5">
        <AvatarStack issues={issues} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-foreground truncate">
            {units}{unitsOverflow > 0 && ` +${unitsOverflow}`}
          </p>
          <p className="text-[11px] text-muted-foreground truncate">{summary}</p>
        </div>
      </div>
    </Link>
  );
}

export function TriageWidget({ issues }: { issues: IssueTableItem[] }) {
  if (issues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-center">
        <ClipboardList className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-40" />
        <p className="text-sm text-muted-foreground font-medium">Aucune conversation active pour le moment.</p>
      </div>
    );
  }

  const [spotlight, ...rest] = issues;
  const critical = rest.filter(i => i.severity === 'CRITICAL');
  const standard = rest.filter(i => i.severity !== 'CRITICAL');

  return (
    <div className="p-4 space-y-4">
      <Link
        href={`/admin/issues/${spotlight.id}`}
        className="flex items-start gap-3 rounded-xl border border-border bg-muted p-4 hover:border-primary/40 transition-colors"
      >
        <div className="w-9.5 h-9.5 rounded-full bg-accent border border-border flex items-center justify-center shrink-0">
          <span className="text-[13px] font-bold text-accent-foreground">{unitInitials(spotlight.client?.unitNumber)}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 mb-0.5">
            <p className="text-sm font-bold text-foreground truncate">Unité {spotlight.client?.unitNumber || '—'}</p>
            <span className="text-[10px] font-mono text-muted-foreground ml-auto shrink-0">
              {timeAgo(spotlight.latestMessage?.createdAt ?? spotlight.createdAt ?? new Date())}
            </span>
          </div>
          <p className="text-xs text-foreground/85 leading-relaxed line-clamp-2 mb-2.5">
            {conversationSnippet(spotlight)}
          </p>
          <div className="flex items-center gap-2">
            <SeverityBadge severity={spotlight.severity} />
            <OverdueTag severity={spotlight.severity} createdAt={spotlight.createdAt} status={spotlight.status} />
            <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-bold text-primary-foreground bg-primary rounded-md px-2.5 py-1.5">
              Répondre <ArrowRight className="h-3 w-3" />
            </span>
          </div>
        </div>
      </Link>

      {critical.length > 0 && <Band label="Critique" tone="crit" issues={critical} linkHref="/admin/issues?severity=CRITICAL" />}
      {critical.length > 0 && standard.length > 0 && <div className="h-px bg-border" />}
      {standard.length > 0 && <Band label="Standard" tone="std" issues={standard} linkHref="/admin/issues" />}
    </div>
  );
}
