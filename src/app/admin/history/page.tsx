'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { PaginationControls } from '@/components/ui/pagination';
import { toast } from 'sonner';
import {
  History, Trash2, RotateCcw, ShieldAlert, HardHat, Users, MapPinned, Building2,
  ArrowRight, Pencil, Undo2, ShieldCheck,
} from 'lucide-react';

type DeletedItem = {
  entityType: 'Agent' | 'Client' | 'Area' | 'Building';
  id: number;
  label: string;
  subtitle: string;
  deletedAt: string;
  deletedByName: string | null;
};

type AuditLogEntry = {
  id: number;
  entityType: string;
  entityId: number;
  entityLabel: string;
  action: 'UPDATE' | 'RESTORE' | 'DELETE';
  changes: Record<string, { old: unknown; new: unknown }> | null;
  performedByName: string;
  createdAt: string;
};

const ENTITY_META: Record<string, { icon: typeof HardHat; color: string; restorePath?: string }> = {
  Agent: { icon: HardHat, color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/20', restorePath: 'agents' },
  Client: { icon: Users, color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20', restorePath: 'clients' },
  Area: { icon: MapPinned, color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20', restorePath: 'areas' },
  Building: { icon: Building2, color: 'text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-500/10 border-slate-200 dark:border-slate-500/20', restorePath: 'buildings' },
  Admin: { icon: ShieldCheck, color: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20' },
};

const FIELD_LABELS: Record<string, string> = {
  name: 'Nom', email: 'Email', phone: 'Téléphone', login: 'Identifiant',
  unitNumber: 'Unité', buildingId: 'Immeuble (ID)', agentId: 'Agent (ID)',
  areaId: 'Zone (ID)', address: 'Adresse', passwordHash: 'Mot de passe',
  isSuperAdmin: 'Super Admin', isActive: 'Compte actif',
  mustSetPassword: 'Doit définir un mot de passe', qrUsedAt: 'QR utilisé le',
};

function formatValue(v: unknown) {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Oui' : 'Non';
  return String(v);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

const LIMIT = 15;

export default function AdminHistoryPage() {
  const [forbidden, setForbidden] = useState(false);
  const [tab, setTab] = useState<'deleted' | 'history'>('deleted');

  const [deletedItems, setDeletedItems] = useState<DeletedItem[]>([]);
  const [deletedLoading, setDeletedLoading] = useState(true);
  const [restoringKey, setRestoringKey] = useState<string | null>(null);

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsPage, setLogsPage] = useState(1);
  const [logsLoading, setLogsLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');

  const fetchDeleted = useCallback(() => {
    setDeletedLoading(true);
    fetch('/api/superadmin/deleted')
      .then(res => {
        if (res.status === 401) { setForbidden(true); return []; }
        return res.json();
      })
      .then(data => { setDeletedItems(Array.isArray(data) ? data : []); setDeletedLoading(false); })
      .catch(() => { setDeletedItems([]); setDeletedLoading(false); });
  }, []);

  const fetchLogs = useCallback(() => {
    setLogsLoading(true);
    const params = new URLSearchParams();
    params.set('page', String(logsPage));
    params.set('limit', String(LIMIT));
    if (entityFilter !== 'all') params.set('entityType', entityFilter);
    if (actionFilter !== 'all') params.set('action', actionFilter);
    fetch(`/api/superadmin/history?${params.toString()}`)
      .then(res => {
        if (res.status === 401) { setForbidden(true); return { logs: [], total: 0 }; }
        return res.json();
      })
      .then(data => {
        setLogs(Array.isArray(data.logs) ? data.logs : []);
        setLogsTotal(data.total || 0);
        setLogsLoading(false);
      })
      .catch(() => { setLogs([]); setLogsLoading(false); });
  }, [logsPage, entityFilter, actionFilter]);

  useEffect(() => { fetchDeleted(); }, [fetchDeleted]);
  useEffect(() => { fetchLogs(); }, [fetchLogs]);
  useEffect(() => { setLogsPage(1); }, [entityFilter, actionFilter]);

  const handleRestore = async (item: DeletedItem) => {
    const key = `${item.entityType}:${item.id}`;
    setRestoringKey(key);
    try {
      const path = ENTITY_META[item.entityType].restorePath;
      const res = await fetch(`/api/${path}/${item.id}/restore`, { method: 'POST' });
      if (res.ok) {
        toast.success(`"${item.label}" restauré.`);
        fetchDeleted();
        fetchLogs();
      } else {
        const d = await res.json();
        toast.error(d.error || 'Erreur lors de la restauration.');
      }
    } catch {
      toast.error('Erreur de connexion.');
    } finally {
      setRestoringKey(null);
    }
  };

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
      <div className="space-y-1">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-5 w-1 rounded-full bg-amber-500" />
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Super Admin
          </span>
        </div>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Historique &amp; corbeille</h1>
        <p className="text-muted-foreground text-sm">Éléments supprimés récupérables et journal des modifications.</p>
      </div>

      {/* Tabs */}
      <div className="flex bg-muted border border-border rounded-lg p-1 w-full sm:w-fit">
        <button
          type="button"
          onClick={() => setTab('deleted')}
          className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-xs font-semibold tracking-wide transition-all flex items-center justify-center gap-1.5 ${
            tab === 'deleted' ? 'bg-accent text-foreground shadow-sm border border-border' : 'text-muted-foreground hover:text-foreground border border-transparent'
          }`}
        >
          <Trash2 className="h-3.5 w-3.5" /> Éléments supprimés
          <span className="ml-1 text-[10px] bg-background px-1.5 py-0.5 rounded-full border border-border">{deletedItems.length}</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('history')}
          className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-xs font-semibold tracking-wide transition-all flex items-center justify-center gap-1.5 ${
            tab === 'history' ? 'bg-accent text-foreground shadow-sm border border-border' : 'text-muted-foreground hover:text-foreground border border-transparent'
          }`}
        >
          <History className="h-3.5 w-3.5" /> Modifications
        </button>
      </div>

      {tab === 'deleted' ? (
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {deletedItems.length} élément{deletedItems.length !== 1 ? 's' : ''} dans la corbeille
            </CardTitle>
            <CardDescription className="text-xs">Les suppressions sont réversibles — restaurez un élément pour qu&apos;il redevienne actif.</CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            {deletedLoading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full bg-muted rounded-lg" />)}
              </div>
            ) : deletedItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Trash2 className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm font-medium">La corbeille est vide.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {deletedItems.map(item => {
                  const meta = ENTITY_META[item.entityType];
                  const Icon = meta.icon;
                  const key = `${item.entityType}:${item.id}`;
                  return (
                    <div key={key} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/30 hover:bg-muted/60 transition-colors">
                      <div className={`h-10 w-10 rounded-lg border flex items-center justify-center shrink-0 ${meta.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={meta.color}>{item.entityType}</Badge>
                          <p className="text-sm font-semibold text-foreground truncate">{item.label}</p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {item.subtitle} · Supprimé le {formatDate(item.deletedAt)}
                          {item.deletedByName && <> par <span className="font-medium">{item.deletedByName}</span></>}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={restoringKey === key}
                        onClick={() => handleRestore(item)}
                        className="text-xs shrink-0 gap-1.5 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        {restoringKey === key ? 'Restauration...' : 'Restaurer'}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="border-b border-border pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {logsTotal} entrée{logsTotal !== 1 ? 's' : ''}
              </CardTitle>
              <div className="flex gap-2">
                <Select value={entityFilter} onValueChange={v => setEntityFilter(v || 'all')}>
                  <SelectTrigger className="w-36 bg-muted border-border text-foreground h-8 text-xs">
                    <SelectValue placeholder="Type">
                      {(v: string | null) => v && v !== 'all' ? v : 'Tous types'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous types</SelectItem>
                    <SelectItem value="Agent">Agent</SelectItem>
                    <SelectItem value="Client">Client</SelectItem>
                    <SelectItem value="Area">Zone</SelectItem>
                    <SelectItem value="Building">Immeuble</SelectItem>
                    <SelectItem value="Admin">Administrateur</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={actionFilter} onValueChange={v => setActionFilter(v || 'all')}>
                  <SelectTrigger className="w-36 bg-muted border-border text-foreground h-8 text-xs">
                    <SelectValue placeholder="Action">
                      {(v: string | null) => v === 'UPDATE' ? 'Modifications' : v === 'RESTORE' ? 'Restaurations' : 'Toutes actions'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes actions</SelectItem>
                    <SelectItem value="UPDATE">Modifications</SelectItem>
                    <SelectItem value="RESTORE">Restaurations</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            {logsLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full bg-muted rounded-lg" />)}
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <History className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm font-medium">Aucune modification enregistrée.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {logs.map(log => {
                  const meta = ENTITY_META[log.entityType];
                  const Icon = meta?.icon ?? Pencil;
                  return (
                    <div key={log.id} className="p-3 rounded-xl border border-border bg-muted/30">
                      <div className="flex items-start gap-3">
                        <div className={`h-9 w-9 rounded-lg border flex items-center justify-center shrink-0 ${meta?.color ?? 'text-muted-foreground bg-muted border-border'}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className={meta?.color}>{log.entityType}</Badge>
                            {log.action === 'RESTORE' ? (
                              <Badge variant="outline" className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 gap-1">
                                <Undo2 className="h-3 w-3" /> Restauré
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20 gap-1">
                                <Pencil className="h-3 w-3" /> Modifié
                              </Badge>
                            )}
                            <p className="text-sm font-semibold text-foreground truncate">{log.entityLabel}</p>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDate(log.createdAt)} par <span className="font-medium">{log.performedByName}</span>
                          </p>
                          {log.changes && Object.keys(log.changes).length > 0 && (
                            <div className="mt-2.5 border border-border rounded-lg overflow-hidden">
                              {Object.entries(log.changes).map(([field, { old: oldVal, new: newVal }], idx, arr) => (
                                <div
                                  key={field}
                                  className={`flex flex-wrap items-center gap-2 px-3 py-2 text-xs ${idx !== arr.length - 1 ? 'border-b border-border' : ''}`}
                                >
                                  <span className="font-semibold text-foreground w-32 shrink-0">{FIELD_LABELS[field] ?? field}</span>
                                  <span className="text-muted-foreground line-through decoration-destructive/50">{formatValue(oldVal)}</span>
                                  <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                                  <span className="text-foreground font-medium">{formatValue(newVal)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <PaginationControls page={logsPage} total={logsTotal} limit={LIMIT} onPageChange={setLogsPage} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
