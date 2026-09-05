'use client';

import { useState, useEffect, use, useRef } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/ui/status-badge';
import { SeverityBadge } from '@/components/ui/severity-badge';
import { OverdueTag } from '@/components/ui/overdue-tag';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { showUndoToast } from '@/components/ui/undo-toast';
import { MediaGallery } from '@/components/ui/media-gallery';
import { pushNotifications } from '@/lib/notify';
import {
  ArrowLeft,
  Calendar,
  AlertTriangle,
  FolderOpen,
  X,
  CheckCircle2,
  Upload,
} from 'lucide-react';

type Media = { id: number; type: string; url: string };
type IssueDetails = {
  id: number;
  originalDescription: string;
  aiDescription: string | null;
  status: string;
  severity: string;
  createdAt: string;
  media: Media[];
  client: { name: string; unitNumber: string; login: string };
  agentId: number | null;
};

export default function AgentIssueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [issue, setIssue] = useState<IssueDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedSeverity, setSelectedSeverity] = useState('');

  const [showVisitModal, setShowVisitModal] = useState(false);
  const [visitDate, setVisitDate] = useState('');
  const rejectCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visitCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolveFiles, setResolveFiles] = useState<File[]>([]);
  const [resolveNote, setResolveNote] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState('');
  const resolveCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closeResolveModal = () => {
    setShowResolveModal(false);
    setResolveError('');
    if (resolveFiles.length === 0 && !resolveNote.trim()) return;
    showUndoToast({
      message: 'Résolution annulée',
      description: 'Les fichiers ajoutés seront perdus.',
      duration: 5000,
      onUndo: () => {
        if (resolveCloseTimerRef.current) {
          clearTimeout(resolveCloseTimerRef.current);
          resolveCloseTimerRef.current = null;
        }
        setShowResolveModal(true);
      },
    });
    resolveCloseTimerRef.current = setTimeout(() => {
      setResolveFiles([]);
      setResolveNote('');
    }, 5000);
  };

  const closeRejectModal = () => {
    setShowRejectModal(false);
    if (!rejectReason.trim()) return;
    showUndoToast({
      message: 'Rejet annulé',
      description: 'Le motif saisi sera perdu.',
      duration: 5000,
      onUndo: () => {
        if (rejectCloseTimerRef.current) {
          clearTimeout(rejectCloseTimerRef.current);
          rejectCloseTimerRef.current = null;
        }
        setShowRejectModal(true);
      },
    });
    rejectCloseTimerRef.current = setTimeout(() => setRejectReason(''), 5000);
  };

  const closeVisitModal = () => {
    setShowVisitModal(false);
    if (!visitDate.trim()) return;
    showUndoToast({
      message: 'Planification annulée',
      description: 'La date sélectionnée sera perdue.',
      duration: 5000,
      onUndo: () => {
        if (visitCloseTimerRef.current) {
          clearTimeout(visitCloseTimerRef.current);
          visitCloseTimerRef.current = null;
        }
        setShowVisitModal(true);
      },
    });
    visitCloseTimerRef.current = setTimeout(() => setVisitDate(''), 5000);
  };

  useEffect(() => {
    fetchIssue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedParams.id]);

  const fetchIssue = () => {
    fetch(`/api/issues/${resolvedParams.id}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setIssue(null);
        } else {
          setIssue(data);
        }
        setLoading(false);
      })
      .catch(() => {
        setIssue(null);
        setLoading(false);
      });
  };

  const updateStatus = async (status: string, extraData = {}) => {
    try {
      const res = await fetch(`/api/issues/${resolvedParams.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...extraData }),
      });
      if (res.ok) {
        setShowRejectModal(false);
        fetchIssue();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const scheduleVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitDate) return;
    try {
      const res = await fetch(`/api/issues/${resolvedParams.id}/visits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledAt: visitDate }),
      });
      if (res.ok) {
        setShowVisitModal(false);
        fetchIssue();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const submitResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resolveFiles.length === 0) {
      setResolveError('Ajoutez au moins une photo ou vidéo comme preuve.');
      return;
    }
    setResolving(true);
    setResolveError('');
    try {
      const form = new FormData();
      resolveFiles.forEach(f => form.append('files', f));
      if (resolveNote.trim()) form.append('note', resolveNote.trim());
      const res = await fetch(`/api/issues/${resolvedParams.id}/resolve`, { method: 'POST', body: form });
      if (res.ok) {
        const data = await res.json();
        setShowResolveModal(false);
        setResolveFiles([]);
        setResolveNote('');
        pushNotifications(data.targetUserIds);
        fetchIssue();
      } else {
        const data = await res.json();
        setResolveError(data.error || 'Erreur lors de la résolution.');
      }
    } catch {
      setResolveError('Erreur réseau.');
    } finally {
      setResolving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <svg className="animate-spin h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (!issue) {
    return (
      <Card className="border-destructive/30 bg-destructive/5 text-center p-8 text-destructive max-w-md mx-auto mt-12">
        <p className="font-semibold">Réclamation introuvable.</p>
        <Link href="/agent/issues" className="text-sm font-semibold text-foreground hover:underline mt-4 inline-block">
          Retour aux réclamations
        </Link>
      </Card>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Back button */}
      <Link href="/agent/issues" className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm font-semibold transition-colors w-fit">
        <ArrowLeft className="h-4 w-4" />
        Retour aux réclamations
      </Link>

      <div className="max-w-4xl space-y-6">
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="border-b border-border pb-5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold text-muted-foreground">#{issue.id}</span>
                    <StatusBadge status={issue.status} />
                    {issue.severity && (
                      <SeverityBadge severity={issue.severity} />
                    )}
                    <OverdueTag severity={issue.severity} createdAt={issue.createdAt} status={issue.status} />
                  </div>
                  <CardTitle className="text-xl font-bold text-foreground mt-3">
                    Détail de l'intervention
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
                  <OverdueTag severity={issue.severity} createdAt={issue.createdAt} status={issue.status} variant="full" />
                </div>

                {/* Client Info Summary */}
                <div className="bg-muted border border-border p-3 rounded-xl flex items-center gap-3 shrink-0">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-accent text-foreground text-xs font-bold">
                      {(issue.client?.name || issue.client?.login || 'C').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Résident</p>
                    <p className="text-xs font-bold text-foreground mt-0.5">{issue.client?.name || issue.client?.login || 'Client'}</p>
                    <p className="text-[10px] text-muted-foreground font-medium mt-0.5">Unité {issue.client?.unitNumber || '?'}</p>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-6 space-y-6">

              {/* Primary Actions for Agent */}
              {issue.status === 'PENDING_AGENT' && (
                <div className="bg-muted/50 border border-border rounded-xl p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <div className="flex-1 text-center sm:text-left">
                      <p className="text-xs font-bold text-foreground">Prise en charge requise</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Qualifiez la priorité avant d&apos;accepter cette réclamation.</p>
                    </div>
                    <div className="w-full sm:w-48">
                      <Select value={selectedSeverity} onValueChange={v => setSelectedSeverity(v ?? '')}>
                        <SelectTrigger className="h-9 text-xs bg-card border-border w-full">
                          <SelectValue placeholder="Priorité...">
                            {(value: string | null) => ({ CRITICAL: 'Critique', MEDIUM: 'Moyen', LOW: 'Faible' } as Record<string, string>)[value ?? ''] ?? 'Priorité...'}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CRITICAL">Critique</SelectItem>
                          <SelectItem value="MEDIUM">Moyen</SelectItem>
                          <SelectItem value="LOW">Faible</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex gap-2.5 w-full sm:w-auto sm:justify-end">
                    <Button
                      onClick={() => setShowRejectModal(true)}
                      variant="outline"
                      className="flex-1 sm:flex-none border-destructive/30 hover:border-destructive/50 text-destructive hover:text-destructive hover:bg-destructive/10 text-xs font-semibold px-4 h-9 rounded-lg"
                    >
                      Rejeter
                    </Button>
                    <Button
                      onClick={() => updateStatus('IN_PROGRESS', { severity: selectedSeverity })}
                      disabled={!selectedSeverity}
                      className="flex-1 sm:flex-none bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold px-4 h-9 rounded-lg shadow-md active:scale-95 disabled:opacity-60"
                    >
                      Accepter et gérer
                    </Button>
                  </div>
                </div>
              )}

              {issue.status === 'IN_PROGRESS' && (
                <div className="bg-muted/50 border border-border rounded-xl p-4 flex flex-col sm:flex-row items-center gap-3">
                  <div className="flex-1 text-center sm:text-left">
                    <p className="text-xs font-bold text-foreground">Intervention en cours</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Vous avez pris en charge ce ticket. Planifiez vos visites ou résolvez le dossier.</p>
                  </div>
                  <div className="flex gap-2.5 w-full sm:w-auto">
                    <Button
                      onClick={() => setShowVisitModal(true)}
                      variant="outline"
                      className="flex-1 sm:flex-none border-border text-foreground hover:bg-accent text-xs font-semibold px-4 h-9 rounded-lg"
                    >
                      Planifier une visite
                    </Button>
                    <Button
                      onClick={() => setShowResolveModal(true)}
                      className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 h-9 rounded-lg shadow-md shadow-emerald-600/10 active:scale-95"
                    >
                      Marquer résolu
                    </Button>
                  </div>
                </div>
              )}

              {/* Description */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Description client</h4>
                <div className="p-4 bg-muted/40 border border-border rounded-xl">
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap font-medium">
                    {issue.originalDescription}
                  </p>
                </div>
              </div>

              {/* Media gallery */}
              {issue.media && issue.media.length > 0 && (
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
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="bg-card border-border w-full max-w-md shadow-2xl relative">
            <Button
              onClick={closeRejectModal}
              variant="ghost"
              className="absolute top-3 right-3 h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg"
            >
              <X className="h-4 w-4" />
            </Button>
            <CardHeader>
              <CardTitle className="text-md font-bold flex items-center gap-1.5 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Rejeter la réclamation
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Veuillez indiquer le motif justifiant le rejet de cette demande. Le résident en sera informé.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="rejectionReason" className="text-xs text-muted-foreground font-semibold">Motif du rejet *</Label>
                <Textarea
                  id="rejectionReason"
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  placeholder="Ex: Le dommage constaté sort du cadre contractuel de la garantie décennale..."
                  rows={4}
                  className="bg-muted/40 border-border focus-visible:ring-destructive/40 text-foreground placeholder-muted-foreground rounded-xl resize-none p-3"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  onClick={closeRejectModal}
                  variant="ghost"
                  className="text-muted-foreground hover:text-foreground hover:bg-accent text-xs font-semibold h-9"
                >
                  Annuler
                </Button>
                <Button
                  onClick={() => updateStatus('REJECTED', { rejectionReason: rejectReason })}
                  disabled={!rejectReason.trim()}
                  className="bg-destructive text-white hover:bg-destructive/90 text-xs font-semibold h-9 px-4 rounded-lg shadow-md active:scale-95 disabled:opacity-65"
                >
                  Confirmer le rejet
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Visit scheduling Modal */}
      {showVisitModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="bg-card border-border w-full max-w-md shadow-2xl relative">
            <Button
              onClick={closeVisitModal}
              variant="ghost"
              className="absolute top-3 right-3 h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg"
            >
              <X className="h-4 w-4" />
            </Button>
            <CardHeader>
              <CardTitle className="text-md font-bold text-foreground flex items-center gap-1.5">
                <Calendar className="h-5 w-5" />
                Planifier une intervention sur site
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Fixez une date et une heure pour votre passage dans le logement du client.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={scheduleVisit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="visitDate" className="text-xs text-muted-foreground font-semibold">Date & Heure du passage *</Label>
                  <input
                    id="visitDate"
                    type="datetime-local"
                    required
                    value={visitDate}
                    onChange={e => setVisitDate(e.target.value)}
                    className="w-full bg-muted/40 border border-border text-foreground rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring/50"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    onClick={closeVisitModal}
                    variant="ghost"
                    className="text-muted-foreground hover:text-foreground hover:bg-accent text-xs font-semibold h-9"
                  >
                    Annuler
                  </Button>
                  <Button
                    type="submit"
                    className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold h-9 px-4 rounded-lg shadow-md active:scale-95"
                  >
                    Valider le rendez-vous
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Resolve Modal */}
      {showResolveModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="bg-card border-border w-full max-w-md shadow-2xl relative">
            <Button
              onClick={closeResolveModal}
              variant="ghost"
              className="absolute top-3 right-3 h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg"
            >
              <X className="h-4 w-4" />
            </Button>
            <CardHeader>
              <CardTitle className="text-md font-bold text-foreground flex items-center gap-1.5">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                Marquer comme résolu
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Ajoutez une preuve photo ou vidéo de l&apos;intervention. Le résident pourra la consulter avant de confirmer.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitResolve} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground font-semibold">Preuve de résolution *</Label>
                  <label className="flex flex-col items-center justify-center gap-1.5 border border-dashed border-border rounded-xl p-5 cursor-pointer hover:border-foreground/30 hover:bg-accent/40 transition-colors text-center">
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground font-medium">Cliquez pour ajouter des photos/vidéos</span>
                    <input
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      className="hidden"
                      onChange={e => {
                        const picked = Array.from(e.target.files || []);
                        setResolveFiles(prev => [...prev, ...picked]);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  {resolveFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {resolveFiles.map((f, i) => (
                        <span key={i} className="flex items-center gap-1.5 bg-muted border border-border rounded-lg px-2.5 py-1.5 text-[11px] text-foreground">
                          {f.name}
                          <button
                            type="button"
                            onClick={() => setResolveFiles(prev => prev.filter((_, idx) => idx !== i))}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="resolveNote" className="text-xs text-muted-foreground font-semibold">Note (optionnel)</Label>
                  <Textarea
                    id="resolveNote"
                    value={resolveNote}
                    onChange={e => setResolveNote(e.target.value)}
                    placeholder="Ex: Remplacement du joint effectué, plus de fuite constatée."
                    rows={3}
                    className="bg-muted/40 border-border text-foreground placeholder-muted-foreground rounded-xl resize-none p-3"
                  />
                </div>
                {resolveError && (
                  <p className="text-xs font-semibold text-destructive">{resolveError}</p>
                )}
                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    onClick={closeResolveModal}
                    variant="ghost"
                    className="text-muted-foreground hover:text-foreground hover:bg-accent text-xs font-semibold h-9"
                  >
                    Annuler
                  </Button>
                  <Button
                    type="submit"
                    disabled={resolving || resolveFiles.length === 0}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold h-9 px-4 rounded-lg shadow-md active:scale-95 disabled:opacity-60"
                  >
                    {resolving ? 'Envoi...' : 'Confirmer la résolution'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
