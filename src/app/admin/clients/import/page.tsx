'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { AlertTriangle, ArrowLeft, CheckCircle2, FileSpreadsheet, Loader2, Printer, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { invalidateJson } from '@/hooks/useJson';
import { LIMITS } from '@/lib/limits';
import { qrLoginUrl } from '@/components/admin/clients/format';

type Preview = {
  zone: string;
  create: number;
  update: number;
  skipped: { line: number; code: string | null; reason: string }[];
  errors: { line: number; code: string | null; reason: string }[];
  buildings: string[];
  sample: { action: 'create' | 'update'; unitCode: string; name: string; login: string; building: string; floor: string | null; phone: string | null }[];
};

type Credentials = {
  unitCode: string; unitNumber: string; name: string; login: string;
  password: string; qrToken: string; building: string; floor: string | null;
};

type Result = { created: Credentials[]; updated: number; skipped: number; errors: Preview['errors']; buildings: string[] };

const DEFAULT_ZONE = 'Glorious Zenata';

function Rows({ title, rows, tone }: { title: string; rows: Preview['errors']; tone: 'warn' | 'danger' }) {
  if (rows.length === 0) return null;
  return (
    <details className="rounded-lg border border-border bg-card" open={tone === 'danger'}>
      <summary className={`cursor-default px-4 py-2.5 text-sm font-semibold ${tone === 'danger' ? 'text-destructive' : 'text-warning'}`}>
        {title} ({rows.length})
      </summary>
      <ul className="max-h-56 divide-y divide-border overflow-y-auto border-t border-border text-xs">
        {rows.map(row => (
          <li key={`${row.line}-${row.code}`} className="flex gap-3 px-4 py-2">
            <span className="w-16 shrink-0 text-muted-foreground">Ligne {row.line}</span>
            <span className="w-40 shrink-0 font-mono">{row.code ?? '—'}</span>
            <span className="text-muted-foreground">{row.reason}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

export default function ImportClientsPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [zone, setZone] = useState(DEFAULT_ZONE);
  const [busy, setBusy] = useState<'preview' | 'apply' | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');

  const send = async (mode: 'preview' | 'apply') => {
    if (!file) return;
    setBusy(mode);
    setError('');
    try {
      const form = new FormData();
      form.set('file', file);
      form.set('mode', mode);
      form.set('zone', zone);

      const res = await fetch('/api/clients/import', { method: 'POST', body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || 'Import impossible.');
        return;
      }
      if (mode === 'preview') {
        setPreview(body);
        setResult(null);
      } else {
        setResult(body);
        setPreview(null);
        invalidateJson('/api/clients');
        toast.success(`${body.created.length} compte(s) créé(s), ${body.updated} mis à jour.`);
      }
    } catch {
      setError('Erreur de connexion.');
    } finally {
      setBusy(null);
    }
  };

  const pick = (next: File | null) => {
    setFile(next);
    setPreview(null);
    setResult(null);
    setError('');
  };

  return (
    <div className="flex flex-col gap-4 pb-10">
      <Link href="/admin/clients" className="inline-flex w-fit items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground print:hidden">
        <ArrowLeft className="h-3.5 w-3.5" /> Clients
      </Link>

      <div className="print:hidden">
        <h1 className="text-2xl font-bold tracking-tight">Importer des clients</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Le fichier du promoteur, tel quel. Le numéro d’archive (<span className="font-mono">GZ-T1-3-A-A-21</span>) devient
          l’identifiant du résident : réimporter un fichier corrigé met les fiches à jour au lieu de les dupliquer.
        </p>
      </div>

      <section className="rounded-lg border border-border bg-card p-4 print:hidden">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="space-y-1.5">
            <Label htmlFor="import-file">Fichier .xlsx ou .csv *</Label>
            <input
              ref={fileRef}
              id="import-file"
              type="file"
              accept=".xlsx,.xlsm,.csv"
              onChange={e => pick(e.target.files?.[0] ?? null)}
              className="block w-full cursor-pointer rounded-md border border-border bg-muted text-sm text-foreground file:mr-3 file:cursor-pointer file:border-0 file:bg-accent file:px-3 file:py-2 file:text-sm file:font-medium file:text-accent-foreground"
            />
            {file && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <FileSpreadsheet className="h-3.5 w-3.5" /> {file.name} · {(file.size / 1024).toFixed(0)} Ko
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="import-zone">Zone (projet)</Label>
            <Input id="import-zone" value={zone} maxLength={LIMITS.name} onChange={e => setZone(e.target.value)} className="bg-muted" />
            <p className="text-xs text-muted-foreground">Les immeubles seront créés sous cette zone.</p>
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => send('preview')} disabled={!file || busy !== null} className="gap-2">
            {busy === 'preview' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Analyser le fichier
          </Button>
          {preview && preview.create + preview.update > 0 && (
            <Button onClick={() => send('apply')} disabled={busy !== null} variant="outline" className="gap-2">
              {busy === 'apply' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Importer {preview.create} création{preview.create > 1 ? 's' : ''} et {preview.update} mise{preview.update > 1 ? 's' : ''} à jour
            </Button>
          )}
        </div>
      </section>

      {preview && (
        <section className="flex flex-col gap-3 print:hidden">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'À créer', value: preview.create, tone: 'text-success' },
              { label: 'À mettre à jour', value: preview.update, tone: '' },
              { label: 'Ignorées', value: preview.skipped.length, tone: 'text-muted-foreground' },
              { label: 'En erreur', value: preview.errors.length, tone: preview.errors.length ? 'text-destructive' : '' },
            ].map(card => (
              <div key={card.label} className="rounded-lg border border-border bg-card px-4 py-3">
                <p className={`text-2xl font-bold tabular-nums ${card.tone}`}>{card.value}</p>
                <p className="text-xs text-muted-foreground">{card.label}</p>
              </div>
            ))}
          </div>

          {preview.buildings.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Immeubles du fichier, sous « {preview.zone} » : <span className="text-foreground">{preview.buildings.join(', ')}</span>
            </p>
          )}

          {preview.sample.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full text-xs">
                <thead className="border-b border-border text-muted-foreground">
                  <tr>
                    {['', 'Code', 'Identifiant', 'Nom', 'Imm.', 'Étage', 'Téléphone'].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {preview.sample.map(row => (
                    <tr key={row.unitCode}>
                      <td className="px-3 py-1.5">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          row.action === 'create' ? 'bg-success-wash text-success' : 'bg-accent text-accent-foreground'
                        }`}>
                          {row.action === 'create' ? 'Création' : 'Mise à jour'}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 font-mono">{row.unitCode}</td>
                      <td className="px-3 py-1.5 font-mono text-muted-foreground">{row.login}</td>
                      <td className="px-3 py-1.5">{row.name}</td>
                      <td className="px-3 py-1.5">{row.building}</td>
                      <td className="px-3 py-1.5">{row.floor ?? '—'}</td>
                      <td className="px-3 py-1.5 font-mono">{row.phone ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
                Aperçu de {preview.sample.length} ligne{preview.sample.length > 1 ? 's' : ''} — vérifiez qu’aucune colonne n’est décalée.
              </p>
            </div>
          )}

          <Rows title="Lignes en erreur, non importées" rows={preview.errors} tone="danger" />
          <Rows title="Lignes ignorées (magasins)" rows={preview.skipped} tone="warn" />
        </section>
      )}

      {result && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-success/30 bg-success-wash px-4 py-3 print:hidden">
            <p className="text-sm font-medium text-success">
              {result.created.length} compte{result.created.length > 1 ? 's' : ''} créé{result.created.length > 1 ? 's' : ''},
              {' '}{result.updated} mis à jour
              {result.skipped > 0 && `, ${result.skipped} ignorée${result.skipped > 1 ? 's' : ''}`}
              {result.errors.length > 0 && `, ${result.errors.length} en erreur`}.
            </p>
            <div className="flex gap-2">
              <Link href="/admin/clients" className={buttonVariants({ variant: 'outline', size: 'sm' })}>Voir les clients</Link>
              {result.created.length > 0 && (
                <Button size="sm" onClick={() => window.print()} className="gap-1.5">
                  <Printer className="h-3.5 w-3.5" /> Imprimer les fiches
                </Button>
              )}
            </div>
          </div>

          {result.errors.length > 0 && <div className="print:hidden"><Rows title="Lignes en erreur" rows={result.errors} tone="danger" /></div>}

          {result.created.length > 0 && (
            <>
              <p className="rounded-lg border border-warning/30 bg-warning-wash px-4 py-2.5 text-xs text-warning print:hidden">
                Les mots de passe ne sont affichés qu’une fois : imprimez ou enregistrez ces fiches avant de quitter la page.
              </p>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 print:grid-cols-2 print:gap-2">
                {result.created.map(client => (
                  <article key={client.unitCode} className="flex gap-3 rounded-lg border border-border bg-card p-3 print:break-inside-avoid">
                    <div className="shrink-0 rounded bg-white p-1.5">
                      <QRCodeSVG value={qrLoginUrl(client.qrToken)} size={92} />
                    </div>
                    <div className="min-w-0 text-xs">
                      <p className="truncate text-sm font-semibold">{client.name}</p>
                      <p className="text-muted-foreground">
                        {client.building}{client.floor ? ` · Étage ${client.floor}` : ''} · Appt {client.unitNumber}
                      </p>
                      <dl className="mt-2 space-y-0.5">
                        <div className="flex gap-1.5">
                          <dt className="text-muted-foreground">Identifiant</dt>
                          <dd className="truncate font-mono">{client.login}</dd>
                        </div>
                        <div className="flex gap-1.5">
                          <dt className="text-muted-foreground">Mot de passe</dt>
                          <dd className="font-mono font-semibold">{client.password}</dd>
                        </div>
                      </dl>
                      <p className="mt-1.5 text-[10px] text-muted-foreground">
                        Scannez le code ou connectez-vous avec l’identifiant ci-dessus.
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {!preview && !result && (
        <div className="flex items-start gap-2 rounded-lg border border-border bg-card px-4 py-3 text-xs text-muted-foreground print:hidden">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <span>
            Les magasins sont ignorés. Les colonnes CIN et Adresse CIN ne sont pas importées. Rien n’est écrit avant que
            vous confirmiez l’import.
          </span>
        </div>
      )}
    </div>
  );
}
