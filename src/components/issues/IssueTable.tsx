import Link from 'next/link';
import { ArrowRight, ClipboardList } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { buttonVariants } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { SeverityBadge } from '@/components/ui/severity-badge';

export type IssueTableItem = {
  id: number;
  originalDescription: string | null;
  status: string;
  severity: string | null;
  createdAt?: string | Date;
  client?: { unitNumber?: string | null; name?: string | null } | null;
};

/**
 * The one shared issue list — used by both admin and agent, on both the dashboard
 * (short, no pagination) and the full issues page. Desktop gets a table, mobile gets
 * a tappable card list; neither has to be hand-rolled per page again.
 */
export function IssueTable({
  issues,
  basePath,
  showDate = false,
  actionLabel,
  emptyMessage = 'Aucune réclamation trouvée.',
}: {
  issues: IssueTableItem[];
  basePath: string;
  showDate?: boolean;
  actionLabel?: (issue: IssueTableItem) => string;
  emptyMessage?: string;
}) {
  if (issues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-center">
        <ClipboardList className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-40" />
        <p className="text-sm text-muted-foreground font-medium">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground font-medium w-20">ID</TableHead>
              <TableHead className="text-muted-foreground font-medium w-32">Logement</TableHead>
              <TableHead className="text-muted-foreground font-medium">Description</TableHead>
              <TableHead className="text-muted-foreground font-medium w-28">Sévérité</TableHead>
              <TableHead className="text-muted-foreground font-medium w-40">Statut</TableHead>
              {showDate && <TableHead className="text-muted-foreground font-medium w-24">Date</TableHead>}
              <TableHead className="text-muted-foreground font-medium text-right w-24">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {issues.map(issue => (
              <TableRow key={issue.id} className="border-border hover:bg-accent/40 transition-colors">
                <TableCell className="font-mono text-xs font-bold text-muted-foreground">#{issue.id}</TableCell>
                <TableCell>
                  <div className="text-xs font-bold text-foreground">Unité {issue.client?.unitNumber || '—'}</div>
                  {issue.client?.name && (
                    <div className="text-[10px] text-muted-foreground font-medium mt-0.5">{issue.client.name}</div>
                  )}
                </TableCell>
                <TableCell className="max-w-xs">
                  <p className="text-xs text-muted-foreground truncate" title={issue.originalDescription ?? ''}>
                    {issue.originalDescription || <span className="italic">Sans description</span>}
                  </p>
                </TableCell>
                <TableCell><SeverityBadge severity={issue.severity} /></TableCell>
                <TableCell><StatusBadge status={issue.status} /></TableCell>
                {showDate && (
                  <TableCell className="text-xs text-muted-foreground font-medium">
                    {issue.createdAt
                      ? new Date(issue.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
                      : '—'}
                  </TableCell>
                )}
                <TableCell className="text-right">
                  <Link
                    href={`${basePath}/${issue.id}`}
                    className={buttonVariants({
                      variant: 'ghost',
                      size: 'sm',
                      className: 'h-8 px-3 rounded-lg text-foreground hover:bg-accent border border-border text-xs font-semibold gap-1.5 ml-auto',
                    })}
                  >
                    {actionLabel?.(issue)}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden divide-y divide-border">
        {issues.map(issue => (
          <Link
            key={issue.id}
            href={`${basePath}/${issue.id}`}
            className="flex items-center justify-between gap-3 p-4 active:bg-accent/40 transition-colors"
          >
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[10px] font-bold text-muted-foreground">#{issue.id}</span>
                <SeverityBadge severity={issue.severity} />
                <StatusBadge status={issue.status} />
              </div>
              <p className="text-xs font-bold text-foreground truncate">
                Unité {issue.client?.unitNumber || '—'}
                {issue.client?.name && <span className="font-normal text-muted-foreground"> — {issue.client.name}</span>}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {issue.originalDescription || <span className="italic">Sans description</span>}
              </p>
              {showDate && issue.createdAt && (
                <p className="text-[10px] text-muted-foreground font-medium">
                  {new Date(issue.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                </p>
              )}
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </Link>
        ))}
      </div>
    </>
  );
}
