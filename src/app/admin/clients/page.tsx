'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { showUndoToast } from '@/components/ui/undo-toast';
import { QRCodeSVG } from 'qrcode.react';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Home, Plus, X, Mail, Phone, QrCode, Users, Building2, Pencil, Trash2, RefreshCw, ShieldCheck, Copy } from 'lucide-react';

type Client = {
  id: number;
  name: string | null;
  login: string;
  unitNumber: string;
  phone: string | null;
  email: string | null;
  qrToken: string;
  qrUsedAt: string | null;
  mustSetPassword: boolean;
  buildingId: number;
  createdAt: string;
};

type Building = { id: number; name: string };

export default function AdminClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({
    login: '',
    password: '',
    name: '',
    unitNumber: '',
    phone: '',
    email: '',
    buildingId: '',
  });

  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editForm, setEditForm] = useState({
    login: '', name: '', unitNumber: '', phone: '', email: '', buildingId: '', password: '', regenerateQr: false,
  });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set());
  const deleteTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    setBaseUrl(process.env.NEXT_PUBLIC_APP_URL || window.location.origin);
    fetchClients();
    fetch('/api/buildings')
      .then(res => res.ok ? res.json() : [])
      .then(data => setBuildings(Array.isArray(data) ? data : []))
      .catch(() => setBuildings([]));
  }, []);

  const fetchClients = () => {
    fetch('/api/clients')
      .then(res => res.json())
      .then(data => {
        setClients(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        setClients([]);
        setLoading(false);
      });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setShowForm(false);
        setForm({ login: '', password: '', name: '', unitNumber: '', phone: '', email: '', buildingId: '' });
        setSuccess('Client créé avec succès.');
        setTimeout(() => setSuccess(''), 3000);
        fetchClients();
      } else {
        setFormError(data.error || 'Erreur lors de la création.');
      }
    } catch {
      setFormError('Erreur de connexion.');
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (client: Client) => {
    setEditingClient(client);
    setEditForm({
      login: client.login,
      name: client.name || '',
      unitNumber: client.unitNumber,
      phone: client.phone || '',
      email: client.email || '',
      buildingId: client.buildingId ? String(client.buildingId) : '',
      password: '',
      regenerateQr: false,
    });
    setEditError('');
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;
    setConfirmOpen(true);
  };

  const confirmEditSubmit = async () => {
    if (!editingClient) return;
    setEditSubmitting(true);
    setEditError('');
    try {
      const res = await fetch(`/api/clients/${editingClient.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        setEditingClient(null);
        toast.success('Client mis à jour.');
        fetchClients();
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

  const handleDelete = (client: Client) => {
    setHiddenIds(prev => new Set(prev).add(client.id));
    showUndoToast({
      message: `Client "${client.name || client.login}" supprimé`,
      duration: 5000,
      onUndo: () => {
        const t = deleteTimersRef.current.get(client.id);
        if (t) {
          clearTimeout(t);
          deleteTimersRef.current.delete(client.id);
        }
        unhide(client.id);
      },
    });
    const timer = setTimeout(async () => {
      deleteTimersRef.current.delete(client.id);
      try {
        const res = await fetch(`/api/clients/${client.id}`, { method: 'DELETE' });
        if (res.ok) {
          fetchClients();
        } else {
          const d = await res.json();
          toast.error(d.error || 'Erreur lors de la suppression.');
          unhide(client.id);
        }
      } catch {
        toast.error('Erreur de connexion.');
        unhide(client.id);
      }
    }, 5000);
    deleteTimersRef.current.set(client.id, timer);
  };

  const visibleClients = clients.filter(c => !hiddenIds.has(c.id));

  const copyLoginLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Lien de connexion copié.');
    } catch {
      toast.error('Impossible de copier le lien.');
    }
  };

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
            Gestion des clients
          </h1>
          <p className="text-muted-foreground text-sm">
            {visibleClients.length} résident{visibleClients.length !== 1 ? 's' : ''} enregistré{visibleClients.length !== 1 ? 's' : ''} — QR codes disponibles.
          </p>
        </div>
        <Button
          onClick={() => { setShowForm(!showForm); setFormError(''); }}
          className={showForm
            ? 'border border-border bg-card text-foreground hover:bg-accent gap-2'
            : 'bg-primary text-primary-foreground hover:bg-primary/90 gap-2'
          }
          variant={showForm ? 'outline' : 'default'}
        >
          {showForm ? <><X className="h-4 w-4" /> Annuler</> : <><Plus className="h-4 w-4" /> Nouveau client</>}
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
              <Home className="h-4 w-4 text-foreground" />
              Créer un compte client
            </CardTitle>
            <CardDescription className="text-muted-foreground text-xs mt-0.5">
              Un QR code de connexion directe sera automatiquement généré.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 py-5">
            {formError && (
              <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
                {formError}
              </div>
            )}
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-foreground text-sm">Identifiant (Login) *</Label>
                <Input
                  required
                  type="text"
                  value={form.login}
                  onChange={e => setForm({ ...form, login: e.target.value })}
                  placeholder="resident-A101"
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
                <Label className="text-foreground text-sm">Numéro d&apos;unité *</Label>
                <Input
                  required
                  type="text"
                  value={form.unitNumber}
                  onChange={e => setForm({ ...form, unitNumber: e.target.value })}
                  placeholder="A101"
                  className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground text-sm">Immeuble</Label>
                <select
                  value={form.buildingId}
                  onChange={e => setForm({ ...form, buildingId: e.target.value })}
                  className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">— Sélectionner un immeuble —</option>
                  {buildings.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground text-sm">Nom complet</Label>
                <Input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Fatima Benali"
                  className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
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
              <div className="space-y-1.5">
                <Label className="text-foreground text-sm">Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="client@example.com"
                  className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div className="md:col-span-2 pt-2">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                >
                  {submitting ? 'Création en cours...' : 'Créer le client'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Clients Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="bg-card border-border">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-14 w-14 rounded-full bg-muted" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-3/4 bg-muted" />
                    <Skeleton className="h-3 w-1/2 bg-muted" />
                  </div>
                </div>
                <Skeleton className="h-32 w-32 mx-auto bg-muted rounded-lg" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : visibleClients.length === 0 ? (
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Users className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm font-medium">Aucun client enregistré.</p>
            <p className="text-xs mt-1">Créez votre premier résident en cliquant sur &quot;Nouveau client&quot;.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleClients.map(client => {
            const loginUrl = `${baseUrl}/api/auth/qr?token=${client.qrToken}`;
            return (
              <Card key={client.id} className="bg-card border-border shadow-sm hover:shadow-md transition-shadow group">
                <CardContent className="p-6">
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-12 h-12 rounded-full bg-accent border-2 border-border flex items-center justify-center">
                      <Home className="h-5 w-5 text-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-foreground truncate">
                        Unité {client.unitNumber}
                      </h3>
                      <p className="text-sm text-muted-foreground truncate">{client.name || client.login}</p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <IconButton icon={Pencil} onClick={() => openEdit(client)} label="Modifier le client" />
                      <IconButton icon={Trash2} onClick={() => handleDelete(client)} variant="destructive" label="Supprimer le client" />
                    </div>
                  </div>

                  <div className="mb-4">
                    {client.mustSetPassword ? (
                      <Badge variant="outline" className="text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 gap-1">
                        <ShieldCheck className="h-3 w-3" /> En attente d&apos;activation
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 gap-1">
                        <ShieldCheck className="h-3 w-3" /> Compte activé
                      </Badge>
                    )}
                  </div>

                  {/* QR Code */}
                  <div className="flex flex-col items-center mb-5 p-4 bg-muted rounded-xl border border-border">
                    <div className="bg-white p-2 rounded-lg shadow-sm mb-2">
                      <QRCodeSVG value={loginUrl} size={128} />
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground text-center">
                      <QrCode className="h-3 w-3 shrink-0" />
                      {client.qrUsedAt
                        ? 'Code déjà utilisé — régénérez-le si le résident en a besoin d\'un nouveau'
                        : 'Scanner pour activer le compte (usage unique)'}
                    </div>
                    {!client.qrUsedAt && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyLoginLink(loginUrl)}
                        className="mt-2 h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                      >
                        <Copy className="h-3 w-3" /> Copier le lien
                      </Button>
                    )}
                  </div>

                  <Separator className="bg-border mb-4" />

                  {/* Details */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5" /> Login
                      </span>
                      <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        {client.login}
                      </span>
                    </div>
                    {client.phone && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5" /> Tél
                        </span>
                        <span className="text-muted-foreground text-xs">{client.phone}</span>
                      </div>
                    )}
                    {client.email && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5" /> Email
                        </span>
                        <span className="text-muted-foreground text-xs truncate max-w-[140px]">{client.email}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit modal */}
      {editingClient && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="bg-card border-border w-full max-w-md shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <Button
              onClick={() => setEditingClient(null)}
              variant="ghost"
              className="absolute top-3 right-3 h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg"
            >
              <X className="h-4 w-4" />
            </Button>
            <CardHeader>
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <Pencil className="h-4 w-4" />
                Modifier le client
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
                  <Label className="text-foreground text-sm">Identifiant (Login) *</Label>
                  <Input
                    required
                    value={editForm.login}
                    onChange={e => setEditForm({ ...editForm, login: e.target.value })}
                    className="bg-muted border-border text-foreground"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-foreground text-sm">Numéro d&apos;unité *</Label>
                  <Input
                    required
                    value={editForm.unitNumber}
                    onChange={e => setEditForm({ ...editForm, unitNumber: e.target.value })}
                    className="bg-muted border-border text-foreground"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-foreground text-sm">Immeuble</Label>
                  <select
                    value={editForm.buildingId}
                    onChange={e => setEditForm({ ...editForm, buildingId: e.target.value })}
                    className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">— Sélectionner un immeuble —</option>
                    {buildings.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-foreground text-sm">Nom complet</Label>
                  <Input
                    value={editForm.name}
                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
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
                  <Label className="text-foreground text-sm">Email</Label>
                  <Input
                    type="email"
                    value={editForm.email}
                    onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                    className="bg-muted border-border text-foreground"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-foreground text-sm">Nouveau mot de passe temporaire</Label>
                  <Input
                    type="password"
                    value={editForm.password}
                    onChange={e => setEditForm({ ...editForm, password: e.target.value })}
                    placeholder="Laisser vide pour ne pas changer"
                    className="bg-muted border-border text-foreground"
                  />
                  <p className="text-xs text-muted-foreground">
                    Le résident devra définir son propre mot de passe à sa prochaine connexion.
                  </p>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setEditForm({ ...editForm, regenerateQr: !editForm.regenerateQr })}
                    className={`h-5 w-5 rounded-md border shrink-0 flex items-center justify-center transition-colors ${
                      editForm.regenerateQr ? 'bg-amber-500 border-amber-500' : 'bg-muted border-border'
                    }`}
                  >
                    {editForm.regenerateQr && <RefreshCw className="h-3 w-3 text-white" />}
                  </button>
                  <Label className="text-foreground text-sm cursor-pointer" onClick={() => setEditForm({ ...editForm, regenerateQr: !editForm.regenerateQr })}>
                    Régénérer le QR code (invalide l&apos;ancien)
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
              Voulez-vous vraiment enregistrer les modifications du client &quot;{editingClient?.name || editingClient?.login}&quot; ?
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
