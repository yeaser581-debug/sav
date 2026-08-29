'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { forceLogout } from '@/lib/notify';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { ShieldCheck, ShieldAlert, Plus, X, Mail, Calendar, Pencil, Power, PowerOff } from 'lucide-react';

type Admin = {
  id: number;
  name: string;
  email: string;
  isSuperAdmin: boolean;
  isActive: boolean;
  createdAt: string;
};

export default function AdminAdminsPage() {
  const [forbidden, setForbidden] = useState(false);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const [form, setForm] = useState({ name: '', email: '', password: '', isSuperAdmin: false });

  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', password: '', isSuperAdmin: false });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => { fetchAdmins(); }, []);

  const fetchAdmins = () => {
    fetch('/api/admins')
      .then(res => {
        if (res.status === 401) { setForbidden(true); return []; }
        return res.json();
      })
      .then(data => { setAdmins(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => { setAdmins([]); setLoading(false); });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowForm(false);
        setForm({ name: '', email: '', password: '', isSuperAdmin: false });
        setSuccess('Administrateur créé avec succès.');
        setTimeout(() => setSuccess(''), 3000);
        fetchAdmins();
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

  const openEdit = (admin: Admin) => {
    setEditingAdmin(admin);
    setEditForm({ name: admin.name, email: admin.email, password: '', isSuperAdmin: admin.isSuperAdmin });
    setEditError('');
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAdmin) return;
    setConfirmOpen(true);
  };

  const confirmEditSubmit = async () => {
    if (!editingAdmin) return;
    setEditSubmitting(true);
    setEditError('');
    try {
      const res = await fetch(`/api/admins/${editingAdmin.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        setEditingAdmin(null);
        toast.success('Administrateur mis à jour.');
        fetchAdmins();
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

  const toggleActive = async (admin: Admin) => {
    setTogglingId(admin.id);
    try {
      const res = await fetch(`/api/admins/${admin.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !admin.isActive }),
      });
      if (res.ok) {
        toast.success(admin.isActive ? `"${admin.name}" désactivé.` : `"${admin.name}" réactivé.`);
        if (admin.isActive) forceLogout(admin.id); // was active, just got disabled — kick any open session
        fetchAdmins();
      } else {
        const d = await res.json();
        toast.error(d.error || 'Erreur.');
      }
    } catch {
      toast.error('Erreur de connexion.');
    } finally {
      setTogglingId(null);
    }
  };

  const initials = (name: string) =>
    name.split(' ').map(w => w[0]?.toUpperCase()).slice(0, 2).join('');

  if (forbidden) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <ShieldAlert className="h-10 w-10 text-muted-foreground mb-3 opacity-50" />
        <h2 className="text-lg font-bold text-foreground">Accès réservé au Super Admin</h2>
        <p className="text-sm text-muted-foreground mt-1">Cette page n&apos;est pas disponible pour votre compte.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-5 w-1 rounded-full bg-amber-500" />
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Super Admin
            </span>
          </div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">
            Comptes administrateurs
          </h1>
          <p className="text-muted-foreground text-sm">
            {admins.length} compte{admins.length !== 1 ? 's' : ''} admin — gérez les accès et les privilèges.
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
          {showForm ? <><X className="h-4 w-4" /> Annuler</> : <><Plus className="h-4 w-4" /> Nouvel administrateur</>}
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
              <ShieldCheck className="h-4 w-4 text-foreground" />
              Créer un compte administrateur
            </CardTitle>
            <CardDescription className="text-muted-foreground text-xs mt-0.5">
              Le mot de passe est temporaire, l&apos;administrateur devra le modifier à la première connexion.
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
                  placeholder="Nadia Cherkaoui"
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
                  placeholder="admin@example.com"
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
              <div className="flex items-center gap-2.5 pt-6">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, isSuperAdmin: !form.isSuperAdmin })}
                  className={`h-5 w-5 rounded-md border shrink-0 flex items-center justify-center transition-colors ${
                    form.isSuperAdmin ? 'bg-amber-500 border-amber-500' : 'bg-muted border-border'
                  }`}
                >
                  {form.isSuperAdmin && <ShieldCheck className="h-3.5 w-3.5 text-white" />}
                </button>
                <Label className="text-foreground text-sm cursor-pointer" onClick={() => setForm({ ...form, isSuperAdmin: !form.isSuperAdmin })}>
                  Accorder les privilèges Super Admin
                </Label>
              </div>
              <div className="md:col-span-2 pt-2">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                >
                  {submitting ? 'Création en cours...' : 'Créer le compte administrateur'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Admins Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(2)].map((_, i) => (
            <Card key={i} className="bg-card border-border">
              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <Skeleton className="h-14 w-14 rounded-full bg-muted" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-3/4 bg-muted" />
                    <Skeleton className="h-3 w-1/2 bg-muted" />
                  </div>
                </div>
                <Skeleton className="h-16 w-full bg-muted rounded-lg" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {admins.map(admin => (
            <Card key={admin.id} className={`bg-card border-border shadow-sm hover:shadow-md transition-shadow group ${!admin.isActive ? 'opacity-60' : ''}`}>
              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-14 h-14 rounded-full bg-accent border-2 border-border flex items-center justify-center shrink-0">
                    <span className="text-lg font-bold text-foreground">{initials(admin.name) || '?'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-foreground truncate">{admin.name}</h3>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      {admin.isSuperAdmin && (
                        <Badge variant="outline" className="text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 gap-1">
                          <ShieldCheck className="h-3 w-3" /> Super Admin
                        </Badge>
                      )}
                      <Badge variant="outline" className={admin.isActive
                        ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20'
                        : 'text-muted-foreground bg-muted border-border'
                      }>
                        {admin.isActive ? 'Actif' : 'Désactivé'}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <IconButton icon={Pencil} onClick={() => openEdit(admin)} label="Modifier l'administrateur" />
                  </div>
                </div>

                <Separator className="bg-border mb-4" />

                <div className="space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm text-muted-foreground truncate">{admin.email}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground">
                      Inscrit le {new Date(admin.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                </div>

                <Separator className="bg-border my-4" />

                <Button
                  variant="outline"
                  size="sm"
                  disabled={togglingId === admin.id}
                  onClick={() => toggleActive(admin)}
                  className={`w-full text-xs gap-1.5 ${
                    admin.isActive
                      ? 'border-destructive/30 text-destructive hover:bg-destructive/10'
                      : 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10'
                  }`}
                >
                  {admin.isActive ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                  {togglingId === admin.id ? 'Mise à jour...' : admin.isActive ? 'Désactiver le compte' : 'Réactiver le compte'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit modal */}
      {editingAdmin && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="bg-card border-border w-full max-w-md shadow-2xl relative">
            <Button
              onClick={() => setEditingAdmin(null)}
              variant="ghost"
              className="absolute top-3 right-3 h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg"
            >
              <X className="h-4 w-4" />
            </Button>
            <CardHeader>
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <Pencil className="h-4 w-4" />
                Modifier l&apos;administrateur
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
                  <Label className="text-foreground text-sm">Nouveau mot de passe</Label>
                  <Input
                    type="password"
                    value={editForm.password}
                    onChange={e => setEditForm({ ...editForm, password: e.target.value })}
                    placeholder="Laisser vide pour ne pas changer"
                    className="bg-muted border-border text-foreground"
                  />
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setEditForm({ ...editForm, isSuperAdmin: !editForm.isSuperAdmin })}
                    className={`h-5 w-5 rounded-md border shrink-0 flex items-center justify-center transition-colors ${
                      editForm.isSuperAdmin ? 'bg-amber-500 border-amber-500' : 'bg-muted border-border'
                    }`}
                  >
                    {editForm.isSuperAdmin && <ShieldCheck className="h-3.5 w-3.5 text-white" />}
                  </button>
                  <Label className="text-foreground text-sm cursor-pointer" onClick={() => setEditForm({ ...editForm, isSuperAdmin: !editForm.isSuperAdmin })}>
                    Privilèges Super Admin
                  </Label>
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
              Voulez-vous vraiment enregistrer les modifications de l&apos;administrateur &quot;{editingAdmin?.name}&quot; ?
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
