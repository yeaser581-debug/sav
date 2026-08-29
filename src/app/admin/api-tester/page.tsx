'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Terminal, Send, ShieldAlert, Clock, Trash2, RotateCcw } from 'lucide-react';

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

type EndpointDef = {
  group: string;
  label: string;
  method: Method;
  path: string;
  body?: string;
};

const ENDPOINTS: EndpointDef[] = [
  { group: 'Réclamations', label: 'Lister les réclamations', method: 'GET', path: '/api/issues' },
  { group: 'Réclamations', label: 'Détail d\'une réclamation', method: 'GET', path: '/api/issues/1' },
  { group: 'Réclamations', label: 'Modifier une réclamation', method: 'PATCH', path: '/api/issues/1', body: '{\n  "severity": "MEDIUM"\n}' },

  { group: 'Agents', label: 'Lister les agents', method: 'GET', path: '/api/agents' },
  { group: 'Agents', label: 'Créer un agent', method: 'POST', path: '/api/agents', body: '{\n  "name": "Test Agent",\n  "email": "test.agent@example.com",\n  "password": "test1234",\n  "phone": "0600000000"\n}' },
  { group: 'Agents', label: 'Modifier un agent', method: 'PATCH', path: '/api/agents/1', body: '{\n  "phone": "0611111111"\n}' },
  { group: 'Agents', label: 'Supprimer un agent (soft delete)', method: 'DELETE', path: '/api/agents/1' },
  { group: 'Agents', label: 'Restaurer un agent', method: 'POST', path: '/api/agents/1/restore' },

  { group: 'Clients', label: 'Lister les clients', method: 'GET', path: '/api/clients' },
  { group: 'Clients', label: 'Créer un client', method: 'POST', path: '/api/clients', body: '{\n  "login": "test.client",\n  "password": "test1234",\n  "unitNumber": "Z99",\n  "buildingId": "1"\n}' },
  { group: 'Clients', label: 'Modifier un client', method: 'PATCH', path: '/api/clients/1', body: '{\n  "phone": "0622222222"\n}' },
  { group: 'Clients', label: 'Supprimer un client (soft delete)', method: 'DELETE', path: '/api/clients/1' },
  { group: 'Clients', label: 'Restaurer un client', method: 'POST', path: '/api/clients/1/restore' },

  { group: 'Zones', label: 'Lister les zones', method: 'GET', path: '/api/areas' },
  { group: 'Zones', label: 'Créer une zone', method: 'POST', path: '/api/areas', body: '{\n  "name": "Test Zone",\n  "agentId": ""\n}' },
  { group: 'Zones', label: 'Modifier une zone', method: 'PATCH', path: '/api/areas/1', body: '{\n  "name": "Zone renommée"\n}' },
  { group: 'Zones', label: 'Supprimer une zone (soft delete)', method: 'DELETE', path: '/api/areas/1' },
  { group: 'Zones', label: 'Restaurer une zone', method: 'POST', path: '/api/areas/1/restore' },

  { group: 'Immeubles', label: 'Lister les immeubles', method: 'GET', path: '/api/buildings' },
  { group: 'Immeubles', label: 'Créer un immeuble', method: 'POST', path: '/api/buildings', body: '{\n  "name": "Test Building",\n  "address": "123 Test St",\n  "areaId": ""\n}' },
  { group: 'Immeubles', label: 'Modifier un immeuble', method: 'PATCH', path: '/api/buildings/1', body: '{\n  "address": "456 Renamed Ave"\n}' },
  { group: 'Immeubles', label: 'Supprimer un immeuble (soft delete)', method: 'DELETE', path: '/api/buildings/1' },
  { group: 'Immeubles', label: 'Restaurer un immeuble', method: 'POST', path: '/api/buildings/1/restore' },

  { group: 'Contrat', label: 'Voir le contrat SAV', method: 'GET', path: '/api/contract' },

  { group: 'Notifications', label: 'Lister les notifications', method: 'GET', path: '/api/notifications' },

  { group: 'Super Admin', label: 'Éléments supprimés', method: 'GET', path: '/api/superadmin/deleted' },
  { group: 'Super Admin', label: 'Historique des modifications', method: 'GET', path: '/api/superadmin/history' },
];

const METHOD_COLORS: Record<Method, string> = {
  GET: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20',
  POST: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20',
  PATCH: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20',
  DELETE: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20',
};

type HistoryEntry = { method: Method; path: string; status: number; durationMs: number; at: Date };
type ResponseState = { status: number; statusText: string; durationMs: number; body: unknown; headers: Record<string, string> } | null;

function statusColor(status: number) {
  if (status === 0) return 'text-muted-foreground bg-muted border-border';
  if (status < 300) return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20';
  if (status < 400) return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20';
  if (status < 500) return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20';
  return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20';
}

export default function ApiTesterPage() {
  const [forbidden, setForbidden] = useState(false);
  const [method, setMethod] = useState<Method>('GET');
  const [path, setPath] = useState('/api/issues');
  const [headersText, setHeadersText] = useState('Content-Type: application/json');
  const [bodyText, setBodyText] = useState('');
  const [sending, setSending] = useState(false);
  const [response, setResponse] = useState<ResponseState>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    fetch('/api/superadmin/deleted')
      .then(res => { if (res.status === 401) setForbidden(true); })
      .catch(() => {});
  }, []);

  const groups = Array.from(new Set(ENDPOINTS.map(e => e.group)));

  const applyEndpoint = (ep: EndpointDef) => {
    setMethod(ep.method);
    setPath(ep.path);
    setBodyText(ep.body || '');
    setResponse(null);
  };

  const parseHeaders = (): Record<string, string> => {
    const result: Record<string, string> = {};
    for (const line of headersText.split('\n')) {
      const idx = line.indexOf(':');
      if (idx === -1) continue;
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      if (key) result[key] = value;
    }
    return result;
  };

  const executeRequest = async () => {
    setSending(true);
    setResponse(null);
    const start = performance.now();
    try {
      const opts: RequestInit = { method, headers: parseHeaders() };
      if (['POST', 'PATCH', 'DELETE'].includes(method) && bodyText.trim()) {
        opts.body = bodyText;
      }
      const res = await fetch(path, opts);
      const durationMs = Math.round(performance.now() - start);
      const text = await res.text();
      let parsedBody: unknown;
      try { parsedBody = text ? JSON.parse(text) : null; } catch { parsedBody = text; }

      setResponse({
        status: res.status,
        statusText: res.statusText,
        durationMs,
        body: parsedBody,
        headers: Object.fromEntries(res.headers.entries()),
      });
      setHistory(prev => [{ method, path, status: res.status, durationMs, at: new Date() }, ...prev].slice(0, 15));
    } catch (err) {
      const durationMs = Math.round(performance.now() - start);
      setResponse({ status: 0, statusText: 'Network Error', durationMs, body: String(err), headers: {} });
      setHistory(prev => [{ method, path, status: 0, durationMs, at: new Date() }, ...prev].slice(0, 15));
    } finally {
      setSending(false);
    }
  };

  const handleSendClick = () => {
    if (method === 'DELETE') {
      setConfirmDeleteOpen(true);
      return;
    }
    executeRequest();
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
        <h1 className="text-3xl font-bold text-foreground tracking-tight flex items-center gap-2">
          <Terminal className="h-6 w-6" />
          Testeur d&apos;API
        </h1>
        <p className="text-muted-foreground text-sm">
          Envoie de vraies requêtes authentifiées vers l&apos;API — les actions PATCH/DELETE modifient réellement les données.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Endpoint picker */}
        <Card className="bg-card border-border shadow-sm xl:col-span-1">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-sm font-semibold text-foreground">Endpoints connus</CardTitle>
            <CardDescription className="text-xs">Sélectionnez pour pré-remplir la requête.</CardDescription>
          </CardHeader>
          <CardContent className="p-3 max-h-140 overflow-y-auto space-y-4">
            {groups.map(group => (
              <div key={group}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1.5 mb-1.5">{group}</p>
                <div className="space-y-1">
                  {ENDPOINTS.filter(e => e.group === group).map(ep => (
                    <button
                      key={`${ep.method}-${ep.path}-${ep.label}`}
                      type="button"
                      onClick={() => applyEndpoint(ep)}
                      className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-xs transition-colors ${
                        method === ep.method && path === ep.path
                          ? 'bg-accent border border-border'
                          : 'hover:bg-accent/60 border border-transparent'
                      }`}
                    >
                      <Badge variant="outline" className={`${METHOD_COLORS[ep.method]} shrink-0 w-14 justify-center font-mono text-[10px]`}>
                        {ep.method}
                      </Badge>
                      <span className="text-foreground truncate">{ep.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Request builder + response */}
        <div className="xl:col-span-2 space-y-6">
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-sm font-semibold text-foreground">Requête</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="flex gap-2">
                <Select value={method} onValueChange={v => setMethod((v as Method) || 'GET')}>
                  <SelectTrigger className="w-28 bg-muted border-border text-foreground shrink-0">
                    <SelectValue placeholder="Méthode">
                      {(v: string | null) => v || 'GET'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="PATCH">PATCH</SelectItem>
                    <SelectItem value="DELETE">DELETE</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  value={path}
                  onChange={e => setPath(e.target.value)}
                  placeholder="/api/issues"
                  className="bg-muted border-border text-foreground font-mono text-sm flex-1"
                />
                <Button
                  onClick={handleSendClick}
                  disabled={sending || !path}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 shrink-0"
                >
                  <Send className="h-3.5 w-3.5" />
                  {sending ? 'Envoi...' : 'Envoyer'}
                </Button>
              </div>

              <div className="space-y-1.5">
                <Label className="text-foreground text-xs">En-têtes (un par ligne, "Clé: Valeur")</Label>
                <Textarea
                  value={headersText}
                  onChange={e => setHeadersText(e.target.value)}
                  rows={2}
                  className="bg-muted border-border text-foreground font-mono text-xs"
                />
              </div>

              {method !== 'GET' && (
                <div className="space-y-1.5">
                  <Label className="text-foreground text-xs">Corps (JSON)</Label>
                  <Textarea
                    value={bodyText}
                    onChange={e => setBodyText(e.target.value)}
                    rows={6}
                    placeholder="{}"
                    className="bg-muted border-border text-foreground font-mono text-xs"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Response */}
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="border-b border-border pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-foreground">Réponse</CardTitle>
                {response && (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={statusColor(response.status)}>
                      {response.status || 'ERR'} {response.statusText}
                    </Badge>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {response.durationMs}ms
                    </span>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {!response ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Terminal className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-xs">Aucune requête envoyée.</p>
                </div>
              ) : (
                <pre className="p-4 text-xs font-mono text-foreground overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap wrap-break-word">
                  {typeof response.body === 'string' ? response.body : JSON.stringify(response.body, null, 2)}
                </pre>
              )}
            </CardContent>
          </Card>

          {/* Recent history */}
          {history.length > 0 && (
            <Card className="bg-card border-border shadow-sm">
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="text-sm font-semibold text-foreground">Requêtes récentes</CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                {history.map((h, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => { setMethod(h.method); setPath(h.path); }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-xs hover:bg-accent/60 transition-colors"
                  >
                    <Badge variant="outline" className={`${METHOD_COLORS[h.method]} w-14 justify-center font-mono text-[10px] shrink-0`}>
                      {h.method}
                    </Badge>
                    <span className="text-foreground font-mono truncate flex-1">{h.path}</span>
                    <Badge variant="outline" className={`${statusColor(h.status)} shrink-0`}>{h.status || 'ERR'}</Badge>
                    <span className="text-muted-foreground shrink-0">{h.durationMs}ms</span>
                  </button>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Confirm DELETE */}
      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-4 w-4" /> Confirmer la requête DELETE
            </AlertDialogTitle>
            <AlertDialogDescription>
              Cette requête va réellement envoyer <span className="font-mono text-foreground">DELETE {path}</span> à l&apos;API.
              Les suppressions sont réversibles (voir <RotateCcw className="inline h-3 w-3" /> Historique), mais confirmez avant de continuer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={executeRequest}
            >
              Envoyer la requête
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
