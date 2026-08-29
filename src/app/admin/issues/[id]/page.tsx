'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft, User, HardHat, Calendar, Paperclip,
  AlertTriangle, Clock, CheckCircle2, XCircle, AlertOctagon, ShieldCheck
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MediaGallery } from '@/components/ui/media-gallery';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { pushNotifications } from '@/lib/notify';

type Media = { id: number; type: string; url: string };
type Proof = { id: number; type: string; url: string; note: string | null };
type Message = { id: number; message: string; senderType: string; mediaUrl?: string | null; mediaType?: string | null; createdAt: string };
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
};

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  PENDING_AGENT: { label: 'En attente',      color: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30', icon: Clock },
  IN_PROGRESS:   { label: 'En cours',        color: 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/30', icon: AlertOctagon },
  RESOLVED:      { label: 'Résolu',          color: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30', icon: CheckCircle2 },
  CONFIRMED:     { label: 'Confirmé',        color: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30', icon: CheckCircle2 },
  REJECTED:      { label: 'Rejeté',          color: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/30', icon: XCircle },
  DISPUTED:      { label: 'Contesté',        color: 'bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-500/30', icon: AlertTriangle },
};

const severityConfig: Record<string, { label: string; color: string }> = {
  CRITICAL: { label: 'Critique', color: 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/30' },
  MEDIUM:   { label: 'Moyen',    color: 'bg-orange-50 dark:bg-orange-500/15 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-500/30' },
  LOW:      { label: 'Faible',   color: 'bg-muted text-muted-foreground border border-border' },
};

export default function AdminIssueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [issue, setIssue] = useState<IssueDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mobileTab, setMobileTab] = useState<'details' | 'chat'>('details');

  const [agents, setAgents] = useState<{id: number, name: string}[]>([]);
  const [reopenAgentId, setReopenAgentId] = useState('');
  const [reopening, setReopening] = useState(false);

  const fetchIssue = () => {
    fetch(`/api/issues/${resolvedParams.id}`)
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
      const res = await fetch(`/api/issues/${resolvedParams.id}`, {
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
      const res = await fetch(`/api/issues/${resolvedParams.id}`, {
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
      const res = await fetch(`/api/issues/${resolvedParams.id}`, {
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
    fetchIssue();
    fetchAgents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedParams.id]);

  if (loading) return (
    <div className="space-y-6 pb-12">
      <Skeleton className="h-8 w-48 bg-muted" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Skeleton className="h-64 w-full bg-muted rounded-xl" />
          <Skeleton className="h-40 w-full bg-muted rounded-xl" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-40 w-full bg-muted rounded-xl" />
          <Skeleton className="h-64 w-full bg-muted rounded-xl" />
        </div>
      </div>
    </div>
  );

  if (error || !issue) return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
      <p className="text-muted-foreground mb-6">{error || 'Réclamation introuvable.'}</p>
      <Link href="/admin/issues" className={buttonVariants({ variant: 'outline', className: "gap-2 border-border" })}>
        <ArrowLeft className="h-4 w-4" /> Retour aux réclamations
      </Link>
    </div>
  );

  const sc = statusConfig[issue.status] ?? { label: issue.status, color: 'bg-muted text-muted-foreground border-border', icon: Clock };
  const StatusIcon = sc.icon;
  const sev = severityConfig[issue.severity];

  return (
    <div className="space-y-6 pb-12">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3">
        <Link href="/admin/issues" className={buttonVariants({ variant: 'ghost', size: 'sm', className: "gap-2 text-muted-foreground hover:text-foreground hover:bg-accent -ml-2 h-8" })}>
          <ArrowLeft className="h-4 w-4" />
          Réclamations
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium text-muted-foreground">Réclamation #{issue.id}</span>
      </div>

      {/* Page title + status */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Réclamation #{issue.id}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Soumis le {new Date(issue.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {sev && (
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${sev.color}`}>
              {sev.label}
            </span>
          )}
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${sc.color}`}>
            <StatusIcon className="h-3 w-3" />
            {sc.label}
          </span>
        </div>
      </div>

      {/* Mobile section switcher */}
      <div className="lg:hidden flex bg-muted border border-border rounded-lg p-1">
        {([
          { id: 'details', label: 'Détails' },
          { id: 'chat', label: 'Discussion', count: issue.messages?.length ?? 0 },
        ] as const).map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setMobileTab(tab.id)}
            className={`flex-1 px-4 py-1.5 rounded-md text-xs font-semibold tracking-wide transition-all ${
              mobileTab === tab.id
                ? 'bg-accent text-foreground shadow-sm border border-border'
                : 'text-muted-foreground hover:text-foreground border border-transparent'
            }`}
          >
            {tab.label}
            {'count' in tab && (
              <span className="ml-1.5 text-[10px] bg-background px-1.5 py-0.5 rounded-full border border-border">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT column */}
        <div className={`lg:col-span-2 space-y-5 ${mobileTab === 'details' ? 'block' : 'hidden'} lg:block`}>

          {/* Description card */}
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="px-6 py-5 border-b border-border">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <User className="h-4 w-4" /> Description du client
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 py-5">
              <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                {issue.originalDescription}
              </p>
              <Separator className="my-4 bg-border" />
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-accent border border-border flex items-center justify-center">
                  <span className="text-xs font-bold text-foreground">
                    {(issue.client?.name || issue.client?.login || '?')[0].toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {issue.client?.name || issue.client?.login || '—'}
                  </p>
                  <p className="text-xs text-muted-foreground">Unité {issue.client?.unitNumber || '—'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Rejection reason */}
          {issue.rejectionReason && (
            <Card className="bg-card border-destructive/30 shadow-sm">
              <CardContent className="px-6 py-5">
                <p className="text-xs font-semibold text-destructive uppercase tracking-wider mb-2">Motif de rejet</p>
                <p className="text-foreground text-sm">{issue.rejectionReason}</p>
              </CardContent>
            </Card>
          )}

          {/* Media */}
          {issue.media.length > 0 && (
            <Card className="bg-card border-border shadow-sm">
              <CardHeader className="px-6 py-5 border-b border-border">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Paperclip className="h-4 w-4" /> Pièces jointes ({issue.media.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="px-6 py-5">
                <MediaGallery media={issue.media} />
              </CardContent>
            </Card>
          )}

          {/* Resolution proof */}
          {issue.proof && issue.proof.length > 0 && (
            <Card className="bg-card border-border shadow-sm">
              <CardHeader className="px-6 py-5 border-b border-border">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" /> Preuve de résolution
                </CardTitle>
              </CardHeader>
              <CardContent className="px-6 py-5 space-y-3">
                <MediaGallery media={issue.proof} />
                {issue.proof.find(p => p.note) && (
                  <p className="text-foreground text-sm bg-muted border border-border rounded-lg p-4">
                    {issue.proof.find(p => p.note)?.note}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Dispute / reopen */}
          {issue.status === 'DISPUTED' && (
            <Card className="bg-card border-orange-500/30 shadow-sm">
              <CardHeader className="px-6 py-5 border-b border-border">
                <CardTitle className="text-sm font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wider flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> Résolution contestée
                </CardTitle>
              </CardHeader>
              <CardContent className="px-6 py-5 space-y-4">
                {issue.disputeReason && (
                  <p className="text-sm text-foreground bg-muted border border-border rounded-lg p-4 leading-relaxed">
                    {issue.disputeReason}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Réassignez un technicien pour rouvrir ce dossier.
                </p>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <Select
                    value={reopenAgentId || (issue.agent ? String(issue.agent.id) : undefined)}
                    onValueChange={(v: string | null) => v && setReopenAgentId(v)}
                  >
                    <SelectTrigger className="w-full sm:flex-1">
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
                    className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold px-4 h-9 rounded-lg shadow-md active:scale-95 disabled:opacity-60 shrink-0"
                  >
                    {reopening ? 'Réouverture...' : 'Rouvrir le dossier'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Visits */}
          {issue.visits.length > 0 && (
            <Card className="bg-card border-border shadow-sm">
              <CardHeader className="px-6 py-5 border-b border-border">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Visites planifiées
                </CardTitle>
              </CardHeader>
              <CardContent className="px-6 py-5 space-y-2">
                {issue.visits.map(v => (
                  <div key={v.id} className="flex items-center justify-between px-4 py-3 rounded-lg bg-muted border border-border">
                    <span className="text-sm text-foreground">
                      {new Date(v.scheduledAt).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
                      {v.status}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* RIGHT column */}
        <div className="lg:col-span-1 space-y-5">
          {/* Priority + agent assignment: part of "Détails" on mobile */}
          <div className={`space-y-5 ${mobileTab === 'details' ? 'block' : 'hidden'} lg:block`}>
          {/* Priority override card */}
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="px-5 py-4 border-b border-border">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <AlertOctagon className="h-4 w-4" /> Priorité
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 py-4">
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
            </CardContent>
          </Card>

          {/* Agent card */}
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="px-5 py-4 border-b border-border">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <HardHat className="h-4 w-4" /> Agent assigné
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 py-4">
              {issue.agent ? (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent border border-border flex items-center justify-center">
                    <span className="text-sm font-bold text-foreground">
                      {issue.agent.name[0].toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{issue.agent.name}</p>
                    <p className="text-xs text-muted-foreground">{issue.agent.email}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground italic">Aucun agent assigné.</p>
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
                </div>
              )}
            </CardContent>
          </Card>
          </div>

          {/* Chat: its own "Discussion" tab on mobile */}
          {/* Fixed panel between the mobile top bar and the screen edge (no bottom tab bar on
              admin) so the composer never scrolls out of view. Normal in-flow column on lg+. */}
          <div
            className={`lg:block lg:static lg:inset-auto lg:z-auto lg:p-0 ${
              mobileTab === 'chat' ? 'fixed inset-x-0 top-14 bottom-[env(safe-area-inset-bottom)] z-30 p-4' : 'hidden'
            }`}
          >
            <ChatPanel
              issueId={issue.id}
              myRole="ADMIN"
              messages={issue.messages}
              onRefresh={fetchIssue}
              subtitle="Fil de discussion avec le résident"
              className="h-full lg:h-auto lg:max-h-130"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
