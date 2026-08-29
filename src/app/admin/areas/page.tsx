'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { showUndoToast } from '@/components/ui/undo-toast';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { MapPinned, HardHat, Plus, X, Building2, Pencil, Trash2 } from 'lucide-react';

type Area = {
  id: number;
  name: string;
  agent: { id: number; name: string; email: string } | null;
  buildings: { id: number; name: string }[];
};

type AgentOption = { id: number; name: string };

export default function AdminAreasPage() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({ name: '', agentId: '' });

  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [editForm, setEditForm] = useState({ name: '', agentId: '' });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set());
  const deleteTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => { fetchAreas(); fetchAgents(); }, []);

  const fetchAreas = () => {
    fetch('/api/areas')
      .then(res => res.json())
      .then(data => {
        setAreas(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => { setAreas([]); setLoading(false); });
  };

  const fetchAgents = () => {
    fetch('/api/agents')
      .then(res => res.json())
      .then(data => setAgents(Array.isArray(data) ? data : []))
      .catch(() => setAgents([]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/areas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowForm(false);
        setForm({ name: '', agentId: '' });
        setSuccess('Zone créée avec succès.');
        setTimeout(() => setSuccess(''), 3000);
        fetchAreas();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (area: Area) => {
    setEditingArea(area);
    setEditForm({ name: area.name, agentId: area.agent ? String(area.agent.id) : '' });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingArea) return;
    setConfirmOpen(true);
  };

  const confirmEditSubmit = async () => {
    if (!editingArea) return;
    setEditSubmitting(true);
    try {
      const res = await fetch(`/api/areas/${editingArea.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        setEditingArea(null);
        toast.success('Zone mise à jour.');
        fetchAreas();
      } else {
        const d = await res.json();
        toast.error(d.error || 'Erreur lors de la mise à jour.');
      }
    } catch {
      toast.error('Erreur de connexion.');
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

  const handleDelete = (area: Area) => {
    setHiddenIds(prev => new Set(prev).add(area.id));
    showUndoToast({
      message: `Zone "${area.name}" supprimée`,
      duration: 5000,
      onUndo: () => {
        const t = deleteTimersRef.current.get(area.id);
        if (t) {
          clearTimeout(t);
          deleteTimersRef.current.delete(area.id);
        }
        unhide(area.id);
      },
    });
    const timer = setTimeout(async () => {
      deleteTimersRef.current.delete(area.id);
      try {
        const res = await fetch(`/api/areas/${area.id}`, { method: 'DELETE' });
        if (res.ok) {
          fetchAreas();
        } else {
          const d = await res.json();
          toast.error(d.error || 'Erreur lors de la suppression.');
          unhide(area.id);
        }
      } catch {
        toast.error('Erreur de connexion.');
        unhide(area.id);
      }
    }, 5000);
    deleteTimersRef.current.set(area.id, timer);
  };

  const visibleAreas = areas.filter(a => !hiddenIds.has(a.id));

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
            Zones
          </h1>
          <p className="text-muted-foreground text-sm">
            {visibleAreas.length} zone{visibleAreas.length !== 1 ? 's' : ''} — chaque zone relie un agent aux immeubles dont il a la charge.
          </p>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          className={showForm
            ? 'border border-border bg-card text-foreground hover:bg-accent gap-2'
            : 'bg-primary text-primary-foreground hover:bg-primary/90 gap-2'
          }
          variant={showForm ? 'outline' : 'default'}
        >
          {showForm ? <><X className="h-4 w-4" /> Annuler</> : <><Plus className="h-4 w-4" /> Nouvelle zone</>}
        </Button>
      </div>

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
              <MapPinned className="h-4 w-4 text-foreground" />
              Ajouter une zone
            </CardTitle>
            <CardDescription className="text-muted-foreground text-xs mt-0.5">
              Les immeubles assignés à cette zone seront automatiquement routés vers l&apos;agent choisi.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 py-5">
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-foreground text-sm">Nom de la zone *</Label>
                <Input
                  required
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Hay Riad"
                  className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground text-sm">Agent responsable</Label>
                <Select value={form.agentId} onValueChange={v => setForm({ ...form, agentId: v ?? '' })}>
                  <SelectTrigger className="bg-muted border-border w-full">
                    <SelectValue placeholder="Aucun agent (à assigner plus tard)">
                      {(value: string | null) => value ? (agents.find(a => String(a.id) === value)?.name ?? value) : 'Aucun agent (à assigner plus tard)'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map(a => (
                      <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2 pt-2">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                >
                  {submitting ? 'Création en cours...' : 'Créer la zone'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Areas Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="bg-card border-border">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-lg bg-muted" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-3/4 bg-muted" />
                    <Skeleton className="h-3 w-1/2 bg-muted" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : visibleAreas.length === 0 ? (
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <MapPinned className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm font-medium">Aucune zone créée.</p>
            <p className="text-xs mt-1">Créez une zone pour pouvoir router les réclamations vers un agent.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visibleAreas.map(area => (
            <Card key={area.id} className="bg-card border-border shadow-sm hover:shadow-md transition-shadow group">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-accent border border-border flex items-center justify-center shrink-0 group-hover:bg-accent/70 transition-colors">
                    <MapPinned className="h-5 w-5 text-foreground" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base font-semibold text-foreground mb-1">
                        {area.name}
                      </h3>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <IconButton icon={Pencil} onClick={() => openEdit(area)} label="Modifier la zone" />
                        <IconButton icon={Trash2} onClick={() => handleDelete(area)} variant="destructive" label="Supprimer la zone" />
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <HardHat className="h-3.5 w-3.5 shrink-0" />
                      {area.agent ? (
                        <span className="truncate">{area.agent.name}</span>
                      ) : (
                        <span className="italic text-amber-600 dark:text-amber-400">Aucun agent assigné</span>
                      )}
                    </div>

                    <Separator className="my-3 bg-border" />

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Building2 className="h-3.5 w-3.5" />
                      {area.buildings.length} immeuble{area.buildings.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit modal */}
      {editingArea && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="bg-card border-border w-full max-w-md shadow-2xl relative">
            <Button
              onClick={() => setEditingArea(null)}
              variant="ghost"
              className="absolute top-3 right-3 h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg"
            >
              <X className="h-4 w-4" />
            </Button>
            <CardHeader>
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <Pencil className="h-4 w-4" />
                Modifier la zone
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-foreground text-sm">Nom de la zone *</Label>
                  <Input
                    required
                    value={editForm.name}
                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                    className="bg-muted border-border text-foreground"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-foreground text-sm">Agent responsable</Label>
                  <Select value={editForm.agentId} onValueChange={v => setEditForm({ ...editForm, agentId: v ?? '' })}>
                    <SelectTrigger className="bg-muted border-border w-full">
                      <SelectValue placeholder="Aucun agent">
                        {(value: string | null) => value ? (agents.find(a => String(a.id) === value)?.name ?? value) : 'Aucun agent'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {agents.map(a => (
                        <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
              Voulez-vous vraiment enregistrer les modifications de la zone &quot;{editingArea?.name}&quot; ?
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
