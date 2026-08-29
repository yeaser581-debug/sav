'use client';

import { useState, useEffect, use, useRef } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/ui/status-badge';
import { SeverityBadge } from '@/components/ui/severity-badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MediaGallery } from '@/components/ui/media-gallery';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { showUndoToast } from '@/components/ui/undo-toast';
import { pushNotifications } from '@/lib/notify';
import {
  ArrowLeft,
  Calendar,
  CheckCircle,
  FolderOpen,
  ShieldCheck,
  AlertTriangle,
  X,
} from 'lucide-react';

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
  media: Media[];
  proof: Proof[];
  messages: Message[];
  agent: { name: string } | null;
  disputeReason: string | null;
};

const statusLabels: Record<string, string> = {
  PENDING_AGENT: 'En attente d\'agent',
  IN_PROGRESS: 'Intervention en cours',
  RESOLVED: 'Résolu par l\'agent',
  CONFIRMED: 'Résolution confirmée',
  REJECTED: 'Réclamation refusée',
  DISPUTED: 'Résolution contestée',
};

export default function IssueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [issue, setIssue] = useState<IssueDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mobileTab, setMobileTab] = useState<'details' | 'chat'>('details');

  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputing, setDisputing] = useState(false);
  const disputeCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchIssue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedParams.id]);

  const fetchIssue = () => {
    fetch(`/api/issues/${resolvedParams.id}`)
      .then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(data => {
        setIssue(data);
        setLoading(false);
      })
      .catch(() => {
        setError('Erreur lors du chargement de la réclamation.');
        setLoading(false);
      });
  };

  const updateStatus = async (status: string) => {
    try {
      const res = await fetch(`/api/issues/${resolvedParams.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) fetchIssue();
    } catch (err) {
      console.error(err);
    }
  };

  const closeDisputeModal = () => {
    setShowDisputeModal(false);
    if (!disputeReason.trim()) return;
    showUndoToast({
      message: 'Contestation annulée',
      description: 'Le motif saisi sera perdu.',
      duration: 5000,
      onUndo: () => {
        if (disputeCloseTimerRef.current) {
          clearTimeout(disputeCloseTimerRef.current);
          disputeCloseTimerRef.current = null;
        }
        setShowDisputeModal(true);
      },
    });
    disputeCloseTimerRef.current = setTimeout(() => setDisputeReason(''), 5000);
  };

  const submitDispute = async () => {
    if (!disputeReason.trim() || disputing) return;
    setDisputing(true);
    try {
      const res = await fetch(`/api/issues/${resolvedParams.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DISPUTED', disputeReason: disputeReason.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setShowDisputeModal(false);
        setDisputeReason('');
        pushNotifications(data.targetUserIds);
        fetchIssue();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDisputing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <svg className="animate-spin h-8 w-8 text-foreground" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (error || !issue) {
    return (
      <Card className="border-destructive/30 bg-destructive/5 text-center p-8 text-destructive max-w-md mx-auto mt-12">
        <p className="font-semibold">{error || 'Réclamation introuvable.'}</p>
        <Link href="/client/issues" className="text-sm font-semibold text-foreground hover:underline mt-4 inline-block">
          Retour aux réclamations
        </Link>
      </Card>
    );
  }

  // Calculate visual stepper index
  const getStepIndex = (status: string) => {
    if (status === 'PENDING_AGENT') return 1;
    if (status === 'IN_PROGRESS' || status === 'DISPUTED') return 2;
    if (status === 'RESOLVED') return 3;
    if (status === 'CONFIRMED') return 4;
    return 1;
  };

  const currentStep = getStepIndex(issue.status);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Back button */}
      <Link href="/client/issues" className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm font-semibold transition-colors w-fit">
        <ArrowLeft className="h-4 w-4" />
        Retour aux réclamations
      </Link>

      {/* Status Stepper */}
      <Card className="bg-card border-border p-5 hidden md:block">
        <div className="flex items-center justify-between">
          {[
            { step: 1, label: 'Soumission', desc: 'Demande créée' },
            { step: 2, label: 'Prise en charge', desc: 'Technicien assigné' },
            { step: 3, label: 'Résolution', desc: 'Intervention faite' },
            { step: 4, label: 'Validation', desc: 'Dossier clôturé' },
          ].map((item, idx, arr) => (
            <div key={item.step} className="flex items-center flex-1 last:flex-none">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border ${
                  currentStep > item.step ? 'bg-accent text-foreground border-border' :
                  currentStep === item.step ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20 animate-pulse' :
                  'bg-muted text-muted-foreground border-border'
                }`}>
                  {item.step}
                </div>
                <div>
                  <p className={`text-xs font-semibold ${currentStep >= item.step ? 'text-foreground' : 'text-muted-foreground'}`}>{item.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{item.desc}</p>
                </div>
              </div>
              {idx < arr.length - 1 && (
                <div className={`h-[1px] flex-1 mx-4 ${
                  currentStep > item.step ? 'bg-foreground/30' : 'bg-border'
                }`} />
              )}
            </div>
          ))}
        </div>
      </Card>

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

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Details & Media */}
        <div className={`lg:col-span-2 space-y-6 ${mobileTab === 'details' ? 'block' : 'hidden'} lg:block`}>
          <Card className="bg-card border-border shadow-md">
            <CardHeader className="border-b border-border pb-5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold text-muted-foreground">#{issue.id}</span>
                    <StatusBadge status={issue.status} />
                    {issue.severity && issue.severity !== 'NORMAL' && (
                      <SeverityBadge severity={issue.severity} />
                    )}
                  </div>
                  <CardTitle className="text-xl font-bold text-foreground mt-3">
                    Détail de la demande
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    Soumise le {new Date(issue.createdAt).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </CardDescription>
                </div>
                {issue.agent && (
                  <div className="bg-muted border border-border p-3 rounded-xl flex items-center gap-3 shrink-0">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-accent text-foreground text-xs font-bold">
                        {issue.agent.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Technicien</p>
                      <p className="text-xs font-bold text-foreground mt-0.5">{issue.agent.name}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent className="pt-6 space-y-6">
              {/* Description */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Description originale</h4>
                <div className="p-4 bg-muted border border-border rounded-xl">
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap font-medium">
                    {issue.originalDescription}
                  </p>
                </div>
              </div>

              {/* Media gallery */}
              {issue.media.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <FolderOpen className="h-4 w-4" />
                    Pièces jointes ({issue.media.length})
                  </h4>
                  <MediaGallery media={issue.media} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Resolution proof */}
          {issue.proof && issue.proof.length > 0 && (
            <Card className="bg-card border-border shadow-md">
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  Preuve de résolution
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Photos et vidéos fournies par le technicien
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-5 space-y-3">
                <MediaGallery media={issue.proof} />
                {issue.proof.find(p => p.note) && (
                  <p className="text-sm text-foreground bg-muted border border-border rounded-xl p-4 leading-relaxed">
                    {issue.proof.find(p => p.note)?.note}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Validation Banner */}
          {issue.status === 'RESOLVED' && (
            <Card className="border-emerald-500/20 bg-emerald-500/5 shadow-md relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
              <CardContent className="p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-bold text-foreground">L'intervention a été marquée comme résolue</h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      Veuillez vérifier les travaux effectués. Si tout est en ordre, validez la résolution. Si le problème persiste ou n'est pas résolu correctement, vous pouvez contester.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <Button
                    onClick={() => setShowDisputeModal(true)}
                    variant="outline"
                    className="border-destructive/30 text-destructive hover:bg-destructive/10 text-xs font-semibold px-4 py-2 h-9 rounded-lg"
                  >
                    Contester
                  </Button>
                  <Button
                    onClick={() => updateStatus('CONFIRMED')}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2 h-9 rounded-lg shadow-md shadow-emerald-600/10 active:scale-95"
                  >
                    Confirmer la résolution
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Chat & Discussion */}
        {/* On mobile, the "Discussion" tab takes over the screen as a fixed panel (between the
            top bar and the bottom tab bar) so the composer never scrolls out of view. On lg+
            it reverts to a normal in-flow column. */}
        <div
          className={`lg:col-span-1 lg:block lg:static lg:inset-auto lg:z-auto lg:p-0 ${
            mobileTab === 'chat' ? 'fixed inset-x-0 top-14 bottom-24 z-30 p-4' : 'hidden'
          }`}
        >
          <ChatPanel
            issueId={issue.id}
            myRole="CLIENT"
            messages={issue.messages}
            onRefresh={fetchIssue}
            disabled={issue.status === 'CONFIRMED' || issue.status === 'REJECTED'}
            disabledReason="Cette réclamation est clôturée. Les messages sont désactivés."
            subtitle="Fil de discussion avec l'administration"
            className="h-full lg:h-[600px]"
          />
        </div>
      </div>

      {/* Dispute Modal */}
      {showDisputeModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="bg-card border-border w-full max-w-md shadow-2xl relative">
            <Button
              onClick={closeDisputeModal}
              variant="ghost"
              className="absolute top-3 right-3 h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg"
            >
              <X className="h-4 w-4" />
            </Button>
            <CardHeader>
              <CardTitle className="text-md font-bold flex items-center gap-1.5 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Contester la résolution
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Expliquez pourquoi cette intervention ne résout pas votre problème. L&apos;administration sera notifiée et réassignera un technicien.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="disputeReason" className="text-xs text-muted-foreground font-semibold">Motif de la contestation *</Label>
                <Textarea
                  id="disputeReason"
                  value={disputeReason}
                  onChange={e => setDisputeReason(e.target.value)}
                  placeholder="Ex: Le problème persiste après le passage du technicien..."
                  rows={4}
                  className="bg-muted/40 border-border focus-visible:ring-destructive/40 text-foreground placeholder-muted-foreground rounded-xl resize-none p-3"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  onClick={closeDisputeModal}
                  variant="ghost"
                  className="text-muted-foreground hover:text-foreground hover:bg-accent text-xs font-semibold h-9"
                >
                  Annuler
                </Button>
                <Button
                  onClick={submitDispute}
                  disabled={!disputeReason.trim() || disputing}
                  className="bg-destructive text-white hover:bg-destructive/90 text-xs font-semibold h-9 px-4 rounded-lg shadow-md active:scale-95 disabled:opacity-65"
                >
                  {disputing ? 'Envoi...' : 'Confirmer la contestation'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
