'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  ArrowLeft, User, HardHat, Calendar, Paperclip,
  AlertTriangle, Info, AlertOctagon, ShieldCheck
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MediaGallery } from '@/components/ui/media-gallery';
import { StatusBadge } from '@/components/ui/status-badge';
import { SeverityBadge } from '@/components/ui/severity-badge';
import { OverdueTag } from '@/components/ui/overdue-tag';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { pushNotifications } from '@/lib/notify';
import { timeAgo } from '@/lib/utils';

type Media = { id: number; type: string; url: string };
type Proof = { id: number; type: string; url: string; note: string | null };
type Message = { id: number; message: string; senderType: string; mediaUrl?: string | null; mediaType?: string | null; createdAt: string };
type OtherIssue = { id: number; status: string; severity: string | null; originalDescription: string | null; createdAt: string };
type IssueDetails = {
  id: number;
  originalDescription: string;
  aiDescription: string | null;
  status: string;
  severity: string;
  createdAt: string;
  rejectionReason: string | null;
  media: Media[];
  proof: Proof[];
  messages: Message[];
  client: { name: string | null; unitNumber: string; login: string } | null;
  agent: { id: number; name: string; email: string } | null;
  visits: { id: number; scheduledAt: string; status: string }[];
  disputeReason: string | null;
  otherIssues: OtherIssue[];
};

export function ConversationPane({ issueId }: { issueId: number }) {
  const [issue, setIssue] = useState<IssueDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [infoOpen, setInfoOpen] = useState(false);

  const [agents, setAgents] = useState<{ id: number, name: string }[]>([]);
  const [reopenAgentId, setReopenAgentId] = useState('');
  const [reopening, setReopening] = useState(false);

  const fetchIssue = () => {
    fetch(`/api/issues/${issueId}`)
      .then(res => res.ok ? res.json() : Promise.reject(res.status))
      .then(data => { setIssue(data); setLoading(false); })
      .catch(() => { setError('Réclamation introuvable.'); setLoading(false); });
  };

  const fetchAgents = () => {
    fetch('/api/agents')
      .then(res => res.json())
      .then(data => setAgents(data))
      .catch(console.error);
  };

  const assignAgent = async (agentId: string) => {
    try {
      const res = await fetch(`/api/issues/${issueId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: parseInt(agentId), status: 'IN_PROGRESS' }),
      });
      if (res.ok) fetchIssue();
    } catch (err) {
      console.error(err);
    }
  };

  const updateSeverity = async (severity: string) => {
    try {
      const res = await fetch(`/api/issues/${issueId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ severity }),
      });
      if (res.ok) fetchIssue();
    } catch (err) {
      console.error(err);
    }
  };

  const reopenIssue = async () => {
    const agentId = reopenAgentId ? parseInt(reopenAgentId) : issue?.agent?.id;
    if (!agentId || reopening) return;
    setReopening(true);
    try {
      const res = await fetch(`/api/issues/${issueId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, status: 'IN_PROGRESS' }),
      });
      if (res.ok) {
        const data = await res.json();
        pushNotifications(data.targetUserIds);
        setReopenAgentId('');
        fetchIssue();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setReopening(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError('');
    fetchIssue();
    fetchAgents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issueId]);

  if (loading) return (
    <div className="p-4 space-y-4 h-full">
      <Skeleton className="h-8 w-48 bg-muted" />
      <Skeleton className="h-64 w-full bg-muted rounded-xl" />
    </div>
  );

  if (error || !issue) return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6">
      <AlertTriangle className="h-10 w-10 text-muted-foreground mb-4" />
      <p className="text-muted-foreground mb-6 text-sm">{error || 'Réclamation introuvable.'}</p>
      <Link href="/admin/issues" className={buttonVariants({ variant: 'outline', className: "gap-2 border-border" })}>
        <ArrowLeft className="h-4 w-4" /> Retour aux réclamations
      </Link>
    </div>
  );

  const infoContent = (
    <div className="space-y-5">
      {/* Client identity */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-accent border border-border flex items-center justify-center shrink-0">
          <span className="text-sm font-bold text-foreground">
            {(issue.client?.name || issue.client?.login || '?')[0].toUpperCase()}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            {issue.client?.name || issue.client?.login || '—'}
          </p>
          <p className="text-xs text-muted-foreground">Unité {issue.client?.unitNumber || '—'}</p>
        </div>
      </div>

      <Separator />

      {/* Priority + agent */}
      <div className="space-y-3">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <AlertOctagon className="h-3.5 w-3.5" /> Priorité
          </p>
          <Select value={issue.severity ?? undefined} onValueChange={v => v && updateSeverity(v)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Non définie">
                {(value: string | null) => ({ CRITICAL: 'Critique', MEDIUM: 'Moyen', LOW: 'Faible' } as Record<string, string>)[value ?? ''] ?? 'Non définie'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CRITICAL">Critique</SelectItem>
              <SelectItem value="MEDIUM">Moyen</SelectItem>
              <SelectItem value="LOW">Faible</SelectItem>
            </SelectContent>
          </Select>
          <OverdueTag severity={issue.severity} createdAt={issue.createdAt} status={issue.status} variant="full" />
        </div>

        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <HardHat className="h-3.5 w-3.5" /> Agent assigné
          </p>
          {issue.agent ? (
            <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/40 p-2.5">
              <div className="w-8 h-8 rounded-full bg-accent border border-border flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-foreground">{issue.agent.name[0].toUpperCase()}</span>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{issue.agent.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{issue.agent.email}</p>
              </div>
            </div>
          ) : (
            <Select onValueChange={(v: string | null) => v && assignAgent(v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Assigner un agent...">
                  {(value: string | null) => value ? (agents.find(a => a.id.toString() === value)?.name ?? value) : 'Assigner un agent...'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {agents.map(a => (
                  <SelectItem key={a.id} value={a.id.toString()}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Rejection reason */}
      {issue.rejectionReason && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-[11px] font-semibold text-destructive uppercase tracking-wider mb-1.5">Motif de rejet</p>
          <p className="text-foreground text-xs">{issue.rejectionReason}</p>
        </div>
      )}

      {/* Media */}
      {issue.media.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Paperclip className="h-3.5 w-3.5" /> Pièces jointes ({issue.media.length})
          </p>
          <MediaGallery media={issue.media} />
        </div>
      )}

      {/* Resolution proof */}
      {issue.proof && issue.proof.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Preuve de résolution
          </p>
          <div className="space-y-2">
            <MediaGallery media={issue.proof} />
            {issue.proof.find(p => p.note) && (
              <p className="text-foreground text-xs bg-muted border border-border rounded-lg p-3">
                {issue.proof.find(p => p.note)?.note}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Dispute / reopen */}
      {issue.status === 'DISPUTED' && (
        <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-3 space-y-3">
          <p className="text-[11px] font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> Résolution contestée
          </p>
          {issue.disputeReason && (
            <p className="text-xs text-foreground bg-muted border border-border rounded-lg p-3 leading-relaxed">
              {issue.disputeReason}
            </p>
          )}
          <Select
            value={reopenAgentId || (issue.agent ? String(issue.agent.id) : undefined)}
            onValueChange={(v: string | null) => v && setReopenAgentId(v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choisir un agent...">
                {(value: string | null) => value ? (agents.find(a => a.id.toString() === value)?.name ?? value) : 'Choisir un agent...'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {agents.map(a => (
                <SelectItem key={a.id} value={a.id.toString()}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={reopenIssue}
            disabled={reopening || (!reopenAgentId && !issue.agent)}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold h-9 rounded-lg shadow-md active:scale-95 disabled:opacity-60"
          >
            {reopening ? 'Réouverture...' : 'Rouvrir le dossier'}
          </Button>
        </div>
      )}

      {/* Visits */}
      {issue.visits.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" /> Visites planifiées
          </p>
          <div className="space-y-2">
            {issue.visits.map(v => (
              <div key={v.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-muted border border-border">
                <span className="text-xs text-foreground">
                  {new Date(v.scheduledAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
                  {v.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Separator />

      {/* Other reclamations from the same client */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Autres réclamations de ce client
        </p>
        {issue.otherIssues.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Aucune autre réclamation.</p>
        ) : (
          <div className="space-y-1.5">
            {issue.otherIssues.map((o, i) => (
              <Link
                key={o.id}
                href={`/admin/issues/${o.id}`}
                onClick={() => setInfoOpen(false)}
                className={`flex items-start justify-between gap-2 rounded-lg border p-2.5 transition-colors hover:bg-accent ${
                  i === 0 ? 'border-primary/30 bg-accent/40' : 'border-border bg-muted/40'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                    <span className="font-mono text-[10px] text-muted-foreground">#{o.id}</span>
                    <span className="text-[10px] text-muted-foreground">{timeAgo(o.createdAt)}</span>
                    {i === 0 && (
                      <span className="text-[9px] font-bold text-primary uppercase tracking-wide">Plus récente</span>
                    )}
                    <SeverityBadge severity={o.severity} />
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {o.originalDescription || <span className="italic">Sans description</span>}
                  </p>
                </div>
                <StatusBadge status={o.status} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Slim header */}
      <div className="flex items-center gap-2 px-3 h-12 border-b border-border shrink-0 bg-card">
        <Link href="/admin/issues" className="md:hidden text-muted-foreground hover:text-foreground shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="text-xs font-bold text-foreground shrink-0">#{issue.id}</span>
        <SeverityBadge severity={issue.severity} />
        <StatusBadge status={issue.status} />
        <OverdueTag severity={issue.severity} createdAt={issue.createdAt} status={issue.status} />
        <span className="text-[10px] text-muted-foreground ml-auto hidden sm:inline">{timeAgo(issue.createdAt)}</span>
        <Button variant="ghost" size="icon-sm" onClick={() => setInfoOpen(true)} className="lg:hidden text-muted-foreground hover:text-foreground shrink-0">
          <Info className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 min-w-0 p-3">
          <ChatPanel
            issueId={issue.id}
            myRole="ADMIN"
            messages={issue.messages}
            onRefresh={fetchIssue}
            subtitle="Fil de discussion avec le résident"
            className="h-full"
            leadMessage={{
              content: issue.originalDescription,
              senderLabel: issue.client?.name || issue.client?.login || 'Résident',
              createdAt: issue.createdAt,
            }}
          />
        </div>

        <div className="hidden lg:block lg:w-80 shrink-0 border-l border-border overflow-y-auto p-4">
          {infoContent}
        </div>
      </div>

      <Sheet open={infoOpen} onOpenChange={setInfoOpen}>
        <SheetContent side="right" className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <User className="h-4 w-4" /> Détails de la réclamation
            </SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6">
            {infoContent}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
