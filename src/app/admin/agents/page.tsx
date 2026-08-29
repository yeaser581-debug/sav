'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { showUndoToast } from '@/components/ui/undo-toast';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { HardHat, Plus, X, Mail, Phone, Calendar, Users, Pencil, Trash2 } from 'lucide-react';

type Agent = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
};

export default function AdminAgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
  });

  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set());
  const deleteTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    fetchAgents();
  }, []);

  const openEdit = (agent: Agent) => {
    setEditingAgent(agent);
    setEditForm({ name: agent.name, email: agent.email, phone: agent.phone || '', password: '' });
    setEditError('');
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAgent) return;
    setConfirmOpen(true);
  };

  const confirmEditSubmit = async () => {
    if (!editingAgent) return;
    setEditSubmitting(true);
    setEditError('');
    try {
      const res = await fetch(`/api/agents/${editingAgent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        setEditingAgent(null);
        toast.success('Agent mis à jour.');
        fetchAgents();
      } else {
        const d = await res.json();
        setEditError(d.error || 'Erreur lors de la mise à jour.');
      }
    } catch {
      setEditError('Erreur de connexion.');
    } finally {
      setEditSubmitting(false);
    }
  };

  const unhide = (id: number) => {
    setHiddenIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleDelete = (agent: Agent) => {
    setHiddenIds(prev => new Set(prev).add(agent.id));
    showUndoToast({
      message: `Agent "${agent.name}" supprimé`,
      duration: 5000,
      onUndo: () => {
        const t = deleteTimersRef.current.get(agent.id);
        if (t) {
          clearTimeout(t);
          deleteTimersRef.current.delete(agent.id);
        }
        unhide(agent.id);
      },
    });
    const timer = setTimeout(async () => {
      deleteTimersRef.current.delete(agent.id);
      try {
        const res = await fetch(`/api/agents/${agent.id}`, { method: 'DELETE' });
        if (res.ok) {
          fetchAgents();
        } else {
          const d = await res.json();
          toast.error(d.error || 'Erreur lors de la suppression.');
          unhide(agent.id);
        }
      } catch {
        toast.error('Erreur de connexion.');
        unhide(agent.id);
      }
    }, 5000);
    deleteTimersRef.current.set(agent.id, timer);
  };

  const fetchAgents = () => {
    fetch('/api/agents')
      .then(res => res.json())
      .then(data => {
        setAgents(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        setAgents([]);
        setLoading(false);
      });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowForm(false);
        setForm({ name: '', email: '', password: '', phone: '' });
        setSuccess('Agent créé avec succès.');
        setTimeout(() => setSuccess(''), 3000);
        fetchAgents();
      } else {
        const d = await res.json();
        setError(d.error || 'Erreur lors de la création.');
      }
    } catch {
      setError('Erreur de connexion.');
    } finally {
      setSubmitting(false);
    }
  };

  const initials = (name: string) =>
    name.split(' ').map(w => w[0]?.toUpperCase()).slice(0, 2).join('');

  const visibleAgents = agents.filter(a => !hiddenIds.has(a.id));

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-5 w-1 rounded-full bg-foreground" />
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Administration
            </span>
          </div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">
            Gestion des agents
          </h1>
          <p className="text-muted-foreground text-sm">
            {visibleAgents.length} agent{visibleAgents.length !== 1 ? 's' : ''} d&apos;intervention enregistré{visibleAgents.length !== 1 ? 's' : ''}.
          </p>
        </div>
        <Button
          onClick={() => { setShowForm(!showForm); setError(''); }}
          className={showForm
            ? 'border border-border bg-card text-foreground hover:bg-accent gap-2'
            : 'bg-primary text-primary-foreground hover:bg-primary/90 gap-2'
          }
          variant={showForm ? 'outline' : 'default'}
        >
          {showForm ? <><X className="h-4 w-4" /> Annuler</> : <><Plus className="h-4 w-4" /> Nouvel agent</>}
        </Button>
      </div>

      {/* Success / global error */}
      {success && (
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
          {success}
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="px-6 py-5 border-b border-border">
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <HardHat className="h-4 w-4 text-foreground" />
              Créer un compte agent
            </CardTitle>
            <CardDescription className="text-muted-foreground text-xs mt-0.5">
              Le mot de passe est temporaire, l&apos;agent devra le modifier à la première connexion.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 py-5">
            {error && (
              <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-foreground text-sm">Nom complet *</Label>
                <Input
                  required
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Mohamed El Amrani"
                  className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground text-sm">Email *</Label>
                <Input
                  required
                  type="email"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="agent@example.com"
                  className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground text-sm">Mot de passe temporaire *</Label>
                <Input
                  required
                  type="password"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  className="bg-muted border-border text-foreground"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground text-sm">Téléphone</Label>
                <Input
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  placeholder="+212 6XX XX XX XX"
                  className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div className="md:col-span-2 pt-2">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                >
                  {submitting ? 'Création en cours...' : 'Créer le compte agent'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Agents Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="bg-card border-border">
              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <Skeleton className="h-14 w-14 rounded-full bg-muted" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-3/4 bg-muted" />
                    <Skeleton className="h-3 w-1/2 bg-muted" />
                  </div>
                </div>
                <Skeleton className="h-20 w-full bg-muted rounded-lg" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : visibleAgents.length === 0 ? (
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Users className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm font-medium">Aucun agent enregistré.</p>
            <p className="text-xs mt-1 text-muted-foreground">Créez votre premier agent en cliquant sur &quot;Nouvel agent&quot;.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleAgents.map(agent => (
            <Card key={agent.id} className="bg-card border-border shadow-sm hover:shadow-md transition-shadow group">
              <CardContent className="p-6">
                {/* Agent avatar + name */}
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-14 h-14 rounded-full bg-accent border-2 border-border flex items-center justify-center">
                    <span className="text-lg font-bold text-foreground">
                      {initials(agent.name) || '?'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-foreground truncate">{agent.name}</h3>
                    <span className="inline-flex items-center mt-1 gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-muted text-muted-foreground border border-border">
                      <HardHat className="h-3 w-3" />
                      Agent d&apos;intervention
                    </span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <IconButton icon={Pencil} onClick={() => openEdit(agent)} label="Modifier l'agent" />
                    <IconButton icon={Trash2} onClick={() => handleDelete(agent)} variant="destructive" label="Supprimer l'agent" />
                  </div>
                </div>

                <Separator className="bg-border mb-4" />

                {/* Details */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm text-muted-foreground truncate">{agent.email}</span>
                  </div>
                  {agent.phone && (
                    <div className="flex items-center gap-2.5">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm text-muted-foreground">{agent.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2.5">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground">
                      Inscrit le {new Date(agent.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit modal */}
      {editingAgent && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="bg-card border-border w-full max-w-md shadow-2xl relative">
            <Button
              onClick={() => setEditingAgent(null)}
              variant="ghost"
              className="absolute top-3 right-3 h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg"
            >
              <X className="h-4 w-4" />
            </Button>
            <CardHeader>
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <Pencil className="h-4 w-4" />
                Modifier l&apos;agent
              </CardTitle>
            </CardHeader>
            <CardContent>
              {editError && (
                <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
                  {editError}
                </div>
              )}
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-foreground text-sm">Nom complet *</Label>
                  <Input
                    required
                    value={editForm.name}
                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                    className="bg-muted border-border text-foreground"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-foreground text-sm">Email *</Label>
                  <Input
                    required
                    type="email"
                    value={editForm.email}
                    onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                    className="bg-muted border-border text-foreground"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-foreground text-sm">Téléphone</Label>
                  <Input
                    type="tel"
                    value={editForm.phone}
                    onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                    className="bg-muted border-border text-foreground"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-foreground text-sm">Nouveau mot de passe</Label>
                  <Input
                    type="password"
                    value={editForm.password}
                    onChange={e => setEditForm({ ...editForm, password: e.target.value })}
                    placeholder="Laisser vide pour ne pas changer"
                    className="bg-muted border-border text-foreground"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={editSubmitting}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                >
                  {editSubmitting ? 'Enregistrement...' : 'Enregistrer'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Confirm edit */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la mise à jour</AlertDialogTitle>
            <AlertDialogDescription>
              Voulez-vous vraiment enregistrer les modifications de l&apos;agent &quot;{editingAgent?.name}&quot; ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={confirmEditSubmit}
            >
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
