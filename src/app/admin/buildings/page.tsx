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
import { Building2, MapPin, Plus, X, Pencil, Trash2 } from 'lucide-react';

type Area = { id: number; name: string };
type Building = {
  id: number;
  name: string;
  address: string;
  area: { id: number; name: string } | null;
};

export default function AdminBuildingsPage() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({ name: '', address: '', areaId: '' });

  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);
  const [editForm, setEditForm] = useState({ name: '', address: '', areaId: '' });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set());
  const deleteTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => { fetchBuildings(); fetchAreas(); }, []);

  const fetchBuildings = () => {
    fetch('/api/buildings')
      .then(res => res.json())
      .then(data => {
        setBuildings(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => { setBuildings([]); setLoading(false); });
  };

  const fetchAreas = () => {
    fetch('/api/areas')
      .then(res => res.json())
      .then(data => setAreas(Array.isArray(data) ? data : []))
      .catch(() => setAreas([]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/buildings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowForm(false);
        setForm({ name: '', address: '', areaId: '' });
        setSuccess('Immeuble ajouté avec succès.');
        setTimeout(() => setSuccess(''), 3000);
        fetchBuildings();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const assignArea = async (buildingId: number, areaId: string) => {
    try {
      const res = await fetch(`/api/buildings/${buildingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ areaId }),
      });
      if (res.ok) fetchBuildings();
    } catch (err) {
      console.error(err);
    }
  };

  const openEdit = (building: Building) => {
    setEditingBuilding(building);
    setEditForm({ name: building.name, address: building.address || '', areaId: building.area ? String(building.area.id) : '' });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBuilding) return;
    setConfirmOpen(true);
  };

  const confirmEditSubmit = async () => {
    if (!editingBuilding) return;
    setEditSubmitting(true);
    try {
      const res = await fetch(`/api/buildings/${editingBuilding.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        setEditingBuilding(null);
        toast.success('Immeuble mis à jour.');
        fetchBuildings();
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

  const handleDelete = (building: Building) => {
    setHiddenIds(prev => new Set(prev).add(building.id));
    showUndoToast({
      message: `Immeuble "${building.name}" supprimé`,
      duration: 5000,
      onUndo: () => {
        const t = deleteTimersRef.current.get(building.id);
        if (t) {
          clearTimeout(t);
          deleteTimersRef.current.delete(building.id);
        }
        unhide(building.id);
      },
    });
    const timer = setTimeout(async () => {
      deleteTimersRef.current.delete(building.id);
      try {
        const res = await fetch(`/api/buildings/${building.id}`, { method: 'DELETE' });
        if (res.ok) {
          fetchBuildings();
        } else {
          const d = await res.json();
          toast.error(d.error || 'Erreur lors de la suppression.');
          unhide(building.id);
        }
      } catch {
        toast.error('Erreur de connexion.');
        unhide(building.id);
      }
    }, 5000);
    deleteTimersRef.current.set(building.id, timer);
  };

  const visibleBuildings = buildings.filter(b => !hiddenIds.has(b.id));

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
            Immeubles &amp; Zones
          </h1>
          <p className="text-muted-foreground text-sm">
            {visibleBuildings.length} immeuble{visibleBuildings.length !== 1 ? 's' : ''} enregistré{visibleBuildings.length !== 1 ? 's' : ''} dans le patrimoine.
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
          {showForm ? <><X className="h-4 w-4" /> Annuler</> : <><Plus className="h-4 w-4" /> Nouvel immeuble</>}
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
              <Building2 className="h-4 w-4 text-foreground" />
              Ajouter un immeuble
            </CardTitle>
            <CardDescription className="text-muted-foreground text-xs mt-0.5">
              L&apos;immeuble sera disponible lors de la création de nouveaux comptes clients.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 py-5">
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-foreground text-sm">Nom du bâtiment *</Label>
                <Input
                  required
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Résidence Al Andalous"
                  className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground text-sm">Adresse complète *</Label>
                <Input
                  required
                  type="text"
                  value={form.address}
                  onChange={e => setForm({ ...form, address: e.target.value })}
                  placeholder="123 Bd Anfa, Casablanca"
                  className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-foreground text-sm">Zone</Label>
                <Select value={form.areaId} onValueChange={v => setForm({ ...form, areaId: v ?? '' })}>
                  <SelectTrigger className="bg-muted border-border w-full">
                    <SelectValue placeholder="Aucune zone (à assigner plus tard)">
                      {(value: string | null) => value ? (areas.find(a => String(a.id) === value)?.name ?? value) : 'Aucune zone (à assigner plus tard)'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {areas.map(a => (
                      <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {areas.length === 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Aucune zone créée. Créez d&apos;abord une zone dans l&apos;onglet Zones pour pouvoir router les réclamations vers un agent.
                  </p>
                )}
              </div>
              <div className="md:col-span-2 pt-2">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                >
                  {submitting ? 'Ajout en cours...' : "Ajouter l'immeuble"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Buildings Grid */}
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
      ) : visibleBuildings.length === 0 ? (
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Building2 className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm font-medium">Aucun immeuble enregistré.</p>
            <p className="text-xs mt-1">Ajoutez votre premier immeuble en cliquant sur &quot;Nouvel immeuble&quot;.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visibleBuildings.map(building => (
            <Card key={building.id} className="bg-card border-border shadow-sm hover:shadow-md transition-shadow group">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className="w-12 h-12 rounded-xl bg-accent border border-border flex items-center justify-center shrink-0 group-hover:bg-accent/70 transition-colors">
                    <Building2 className="h-5 w-5 text-foreground" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base font-semibold text-foreground mb-1">
                        {building.name}
                      </h3>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <IconButton icon={Pencil} onClick={() => openEdit(building)} label="Modifier l'immeuble" />
                        <IconButton icon={Trash2} onClick={() => handleDelete(building)} variant="destructive" label="Supprimer l'immeuble" />
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{building.address}</span>
                    </div>

                    {building.area && (
                      <>
                        <Separator className="my-3 bg-border" />
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Zone :</span>
                          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-muted text-muted-foreground border border-border">
                            {building.area.name}
                          </span>
                        </div>
                      </>
                    )}

                    {!building.area && (
                      <>
                        <Separator className="my-3 bg-border" />
                        <div className="space-y-1.5">
                          <span className="text-xs text-amber-600 dark:text-amber-400 italic">Aucune zone assignée — les réclamations ne seront pas routées.</span>
                          <Select onValueChange={(v: string | null) => v && assignArea(building.id, v)}>
                            <SelectTrigger className="h-8 text-xs bg-muted border-border w-full">
                              <SelectValue placeholder="Assigner une zone...">
                                {(value: string | null) => value ? (areas.find(a => String(a.id) === value)?.name ?? value) : 'Assigner une zone...'}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {areas.map(a => (
                                <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit modal */}
      {editingBuilding && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="bg-card border-border w-full max-w-md shadow-2xl relative">
            <Button
              onClick={() => setEditingBuilding(null)}
              variant="ghost"
              className="absolute top-3 right-3 h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg"
            >
              <X className="h-4 w-4" />
            </Button>
            <CardHeader>
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <Pencil className="h-4 w-4" />
                Modifier l&apos;immeuble
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-foreground text-sm">Nom du bâtiment *</Label>
                  <Input
                    required
                    value={editForm.name}
                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                    className="bg-muted border-border text-foreground"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-foreground text-sm">Adresse complète *</Label>
                  <Input
                    required
                    value={editForm.address}
                    onChange={e => setEditForm({ ...editForm, address: e.target.value })}
                    className="bg-muted border-border text-foreground"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-foreground text-sm">Zone</Label>
                  <Select value={editForm.areaId} onValueChange={v => setEditForm({ ...editForm, areaId: v ?? '' })}>
                    <SelectTrigger className="bg-muted border-border w-full">
                      <SelectValue placeholder="Aucune zone">
                        {(value: string | null) => value ? (areas.find(a => String(a.id) === value)?.name ?? value) : 'Aucune zone'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {areas.map(a => (
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
              Voulez-vous vraiment enregistrer les modifications de l&apos;immeuble &quot;{editingBuilding?.name}&quot; ?
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
