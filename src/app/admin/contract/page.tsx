'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Save, CheckCircle, AlertCircle, Info } from 'lucide-react';

export default function AdminContractPage() {
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    fetch('/api/contract')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.content) {
          setContent(data.content);
          setOriginalContent(data.content);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (content === originalContent) return;
    setSaving(true);
    setMessage('');
    setIsError(false);

    try {
      const res = await fetch('/api/contract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      if (res.ok) {
        setOriginalContent(content);
        setMessage('Contrat mis à jour avec succès.');
        setIsError(false);
        setTimeout(() => setMessage(''), 4000);
      } else {
        setMessage('Erreur lors de la sauvegarde.');
        setIsError(true);
      }
    } catch {
      setMessage('Erreur de connexion.');
      setIsError(true);
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = content !== originalContent;
  const charCount = content.length;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-5 w-1 rounded-full bg-foreground" />
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Administration
            </span>
          </div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">
            Contrat SAV
          </h1>
          <p className="text-muted-foreground text-sm">
            Éditez les termes du service après-vente — s&apos;applique à tous les nouveaux clients.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {message && (
            <div className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border ${
              isError
                ? 'bg-destructive/10 border-destructive/30 text-destructive'
                : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
            }`}>
              {isError ? <AlertCircle className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />}
              {message}
            </div>
          )}
          <Button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 gap-2"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </Button>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-lg bg-accent/50 border border-border px-4 py-3">
        <Info className="h-4 w-4 text-foreground mt-0.5 shrink-0" />
        <p className="text-sm text-muted-foreground">
          Le contrat supporte la syntaxe <strong>Markdown</strong>. Les modifications s&apos;appliquent globalement pour tous les nouveaux clients après sauvegarde.
        </p>
      </div>

      {/* Editor */}
      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="px-6 py-5 border-b border-border flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <FileText className="h-4 w-4 text-foreground" />
              Contenu du contrat
            </CardTitle>
            <CardDescription className="text-muted-foreground text-xs mt-0.5">
              Markdown supporté — titres, listes, **gras**, *italique*
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            {hasChanges && (
              <span className="text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-2 py-1 rounded">
                Modifications non sauvegardées
              </span>
            )}
            <span className="text-xs text-muted-foreground tabular-nums">{charCount.toLocaleString()} car.</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className={`h-4 bg-muted ${i % 3 === 0 ? 'w-1/2' : i % 2 === 0 ? 'w-3/4' : 'w-full'}`} />
              ))}
            </div>
          ) : (
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="# Contrat de Service Après-Vente&#10;&#10;Saisissez les termes du contrat ici..."
              className="w-full min-h-[60vh] resize-none px-6 py-5 text-sm text-foreground bg-transparent font-mono leading-relaxed placeholder-muted-foreground focus:outline-none focus:ring-0 border-0"
            />
          )}
        </CardContent>
        {!loading && (
          <>
            <Separator className="bg-border" />
            <div className="px-6 py-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Dernière modification: {originalContent ? 'chargé depuis la base de données' : 'aucun contrat existant'}
              </span>
              <Button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                size="sm"
                className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 gap-2 text-xs"
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? 'Sauvegarde...' : 'Sauvegarder les modifications'}
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
