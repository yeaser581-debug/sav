'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { showUndoToast } from '@/components/ui/undo-toast';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  UploadCloud,
  X,
  Film,
  Music,
  FileWarning,
  RotateCcw,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type UploadedMedia = { id: string; type: string };

type UploadStatus = 'uploading' | 'success' | 'error' | 'removing';

type UploadItem = {
  localId: string;
  file: File;
  previewUrl: string;
  status: UploadStatus;
  prevStatus?: UploadStatus;
  progress: number;
  error?: string;
  serverId?: string;
};

const MAX_SIZE = 25 * 1024 * 1024;
const ACCEPTED_PREFIXES = ['image/', 'video/', 'audio/'];
const REMOVE_DELAY_MS = 5000;

function isAcceptedType(type: string) {
  return ACCEPTED_PREFIXES.some(p => type.startsWith(p));
}

function formatFileSize(bytes: number) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function kindOf(file: File): 'image' | 'video' | 'audio' | 'other' {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return 'other';
}

export function IssueFileUpload({
  onChange,
  onBusyChange,
  maxFiles = 5,
  disabled = false,
}: {
  onChange: (media: UploadedMedia[]) => void;
  onBusyChange?: (busy: boolean) => void;
  maxFiles?: number;
  disabled?: boolean;
}) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragDepth, setDragDepth] = useState(0);
  const [dragInvalid, setDragInvalid] = useState(false);
  const [previewItem, setPreviewItem] = useState<UploadItem | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<Map<string, XMLHttpRequest>>(new Map());
  const timerRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Notify parent of the currently-submittable set of media
  useEffect(() => {
    onChange(
      items
        .filter(i => i.status === 'success' && i.serverId)
        .map(i => ({ id: i.serverId!, type: i.file.type }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  useEffect(() => {
    onBusyChange?.(items.some(i => i.status === 'uploading'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  // Cleanup on unmount: abort in-flight uploads, clear timers, revoke blob URLs
  useEffect(() => {
    return () => {
      xhrRef.current.forEach(xhr => xhr.abort());
      timerRef.current.forEach(t => clearTimeout(t));
      items.forEach(i => URL.revokeObjectURL(i.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startUpload = useCallback((localId: string, file: File) => {
    setItems(prev => prev.map(i => i.localId === localId
      ? { ...i, status: 'uploading', progress: 0, error: undefined }
      : i));

    const xhr = new XMLHttpRequest();
    xhrRef.current.set(localId, xhr);
    xhr.open('POST', '/api/uploads/temp');

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const progress = Math.round((e.loaded / e.total) * 100);
      setItems(prev => prev.map(i => i.localId === localId ? { ...i, progress } : i));
    };

    xhr.onload = () => {
      xhrRef.current.delete(localId);
      let data: any = null;
      try { data = JSON.parse(xhr.responseText); } catch { /* ignore */ }

      if (xhr.status >= 200 && xhr.status < 300 && data?.id) {
        setItems(prev => prev.map(i => i.localId === localId
          ? { ...i, status: 'success', progress: 100, serverId: data.id, error: undefined }
          : i));
      } else {
        setItems(prev => prev.map(i => i.localId === localId
          ? { ...i, status: 'error', error: data?.error || 'Échec du téléversement.' }
          : i));
      }
    };

    xhr.onerror = () => {
      xhrRef.current.delete(localId);
      setItems(prev => prev.map(i => i.localId === localId
        ? { ...i, status: 'error', error: 'Erreur réseau. Vérifiez votre connexion.' }
        : i));
    };

    const fd = new FormData();
    fd.append('file', file);
    xhr.send(fd);
  }, []);

  const addFiles = useCallback((fileList: FileList | File[]) => {
    const incoming = Array.from(fileList);
    const currentCount = items.filter(i => i.status !== 'removing').length;
    const room = Math.max(0, maxFiles - currentCount);

    if (room <= 0) {
      toast.warning(`Maximum ${maxFiles} fichiers atteint.`);
      return;
    }

    const accepted: File[] = [];
    for (const file of incoming) {
      if (!isAcceptedType(file.type)) {
        toast.error(`"${file.name}" : format non supporté.`);
        continue;
      }
      if (file.size > MAX_SIZE) {
        toast.error(`"${file.name}" dépasse la taille maximale (25 Mo).`);
        continue;
      }
      accepted.push(file);
    }

    if (accepted.length > room) {
      toast.warning(`Seuls ${room} fichier(s) supplémentaire(s) peuvent être ajoutés (max ${maxFiles}).`);
    }

    const toAdd = accepted.slice(0, room);
    if (!toAdd.length) return;

    const newItems: UploadItem[] = toAdd.map(file => ({
      localId: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'uploading',
      progress: 0,
    }));

    setItems(prev => [...prev, ...newItems]);
    newItems.forEach(i => startUpload(i.localId, i.file));
  }, [items, maxFiles, startUpload]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) addFiles(e.target.files);
    e.target.value = '';
  };

  const retryUpload = (localId: string) => {
    const item = items.find(i => i.localId === localId);
    if (item) startUpload(localId, item.file);
  };

  const finalizeRemoval = useCallback((localId: string) => {
    timerRef.current.delete(localId);
    setItems(prev => {
      const item = prev.find(i => i.localId === localId);
      if (item) {
        if (item.serverId) {
          fetch(`/api/uploads/temp/${item.serverId}`, { method: 'DELETE' }).catch(() => {});
        }
        URL.revokeObjectURL(item.previewUrl);
      }
      return prev.filter(i => i.localId !== localId);
    });
  }, []);

  const removeItem = (localId: string) => {
    const item = items.find(i => i.localId === localId);
    if (!item) return;

    // Nothing durable committed yet — cancel outright, no undo needed.
    if (item.status === 'uploading') {
      xhrRef.current.get(localId)?.abort();
      xhrRef.current.delete(localId);
      setItems(prev => prev.filter(i => i.localId !== localId));
      URL.revokeObjectURL(item.previewUrl);
      return;
    }

    setItems(prev => prev.map(i => i.localId === localId
      ? { ...i, status: 'removing', prevStatus: i.status }
      : i));

    const timer = setTimeout(() => finalizeRemoval(localId), REMOVE_DELAY_MS);
    timerRef.current.set(localId, timer);

    showUndoToast({
      message: `"${item.file.name}" supprimé`,
      duration: REMOVE_DELAY_MS,
      onUndo: () => {
        const t = timerRef.current.get(localId);
        if (t) {
          clearTimeout(t);
          timerRef.current.delete(localId);
        }
        setItems(prev => prev.map(i => i.localId === localId
          ? { ...i, status: i.prevStatus ?? 'success', prevStatus: undefined }
          : i));
      },
    });
  };

  // Drag reactivity — inspect dragged item types where the browser exposes them
  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;
    setDragDepth(d => d + 1);
    const dtItems = Array.from(e.dataTransfer.items || []);
    const hasKnownTypes = dtItems.some(it => it.type);
    const allValid = !hasKnownTypes || dtItems.every(it => !it.type || isAcceptedType(it.type));
    setDragInvalid(!allValid);
  };
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = dragInvalid ? 'none' : 'copy';
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragDepth(d => Math.max(0, d - 1));
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragDepth(0);
    setDragInvalid(false);
    if (disabled) return;
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const isDragging = dragDepth > 0;
  const visibleItems = items;

  return (
    <div className="space-y-3">
      <div
        onClick={() => !disabled && fileInputRef.current?.click()}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          'w-full border-2 border-dashed rounded-xl p-8 text-center transition-all duration-150 group',
          disabled ? 'opacity-60 cursor-not-allowed border-border bg-muted/30' : 'cursor-pointer',
          !disabled && !isDragging && 'border-border hover:border-foreground/40 bg-muted/30 hover:bg-muted/60',
          isDragging && !dragInvalid && 'border-primary bg-primary/5 scale-[1.01] ring-4 ring-primary/10',
          isDragging && dragInvalid && 'border-destructive bg-destructive/5 ring-4 ring-destructive/10'
        )}
      >
        {isDragging && dragInvalid ? (
          <>
            <FileWarning className="h-10 w-10 text-destructive mx-auto mb-3" />
            <p className="text-sm font-bold text-destructive">Format non supporté</p>
            <p className="text-xs text-muted-foreground mt-1">Seuls les images, vidéos et audios sont acceptés</p>
          </>
        ) : (
          <>
            <UploadCloud className={cn(
              'h-10 w-10 mx-auto mb-3 transition-all duration-150',
              isDragging ? 'text-primary scale-110' : 'text-muted-foreground group-hover:text-foreground'
            )} />
            <p className="text-sm font-bold text-foreground transition-colors">
              {isDragging ? 'Déposez vos fichiers ici' : 'Déposer vos fichiers ou cliquer pour parcourir'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Formats acceptés : Images, Vidéos et Enregistrements audio (max. {maxFiles} fichiers, 25 Mo chacun)
            </p>
          </>
        )}
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        multiple
        accept="image/*,video/*,audio/*"
        className="hidden"
        disabled={disabled}
      />

      {visibleItems.length > 0 && (
        <div className="space-y-2 pt-1">
          {visibleItems.map(item => {
            const kind = kindOf(item.file);
            const removing = item.status === 'removing';

            return (
              <div
                key={item.localId}
                className={cn(
                  'flex items-center justify-between border rounded-xl p-3 transition-all duration-300',
                  removing
                    ? 'bg-muted/40 border-border opacity-50 grayscale'
                    : item.status === 'error'
                    ? 'bg-destructive/5 border-destructive/30'
                    : 'bg-muted border-border'
                )}
              >
                <button
                  type="button"
                  onClick={() => !removing && setPreviewItem(item)}
                  disabled={removing}
                  className="flex items-center gap-3 overflow-hidden text-left flex-1 min-w-0 disabled:cursor-default"
                >
                  <div className="w-10 h-10 rounded-lg bg-background border border-border flex items-center justify-center shrink-0 overflow-hidden">
                    {kind === 'image' ? (
                      <img src={item.previewUrl} alt="" className="w-full h-full object-cover" />
                    ) : kind === 'video' ? (
                      <Film className="h-4.5 w-4.5 text-muted-foreground" />
                    ) : (
                      <Music className="h-4.5 w-4.5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-foreground truncate">{item.file.name}</p>
                    {item.status === 'uploading' ? (
                      <div className="flex items-center gap-2 mt-1">
                        <div className="h-1.5 flex-1 max-w-35 rounded-full bg-background overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-150"
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground tabular-nums">{item.progress}%</span>
                      </div>
                    ) : item.status === 'error' ? (
                      <p className="text-[10px] text-destructive mt-0.5">{item.error || 'Échec du téléversement'}</p>
                    ) : removing ? (
                      <p className="text-[10px] text-muted-foreground mt-0.5">Suppression en cours...</p>
                    ) : (
                      <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                        <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" />
                        {formatFileSize(item.file.size)}
                      </p>
                    )}
                  </div>
                </button>

                <div className="flex items-center gap-1 shrink-0">
                  {item.status === 'uploading' && (
                    <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin mr-1" />
                  )}
                  {item.status === 'error' && !removing && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => retryUpload(item.localId)}
                      className="h-8 px-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg gap-1 text-[11px]"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Réessayer
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => removeItem(item.localId)}
                    disabled={removing}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!previewItem} onOpenChange={(open) => !open && setPreviewItem(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="truncate pr-6">{previewItem?.file.name}</DialogTitle>
            <DialogDescription>
              {previewItem && formatFileSize(previewItem.file.size)}
            </DialogDescription>
          </DialogHeader>
          {previewItem && (
            <div className="flex items-center justify-center rounded-lg bg-black/5 dark:bg-black/40 p-2">
              {kindOf(previewItem.file) === 'image' && (
                <img
                  src={previewItem.previewUrl}
                  alt={previewItem.file.name}
                  className="max-h-[70vh] w-auto max-w-full rounded-lg object-contain"
                />
              )}
              {kindOf(previewItem.file) === 'video' && (
                <video
                  src={previewItem.previewUrl}
                  controls
                  autoPlay
                  className="max-h-[70vh] w-full rounded-lg"
                />
              )}
              {kindOf(previewItem.file) === 'audio' && (
                <div className="w-full flex flex-col items-center gap-4 py-8">
                  <Music className="h-12 w-12 text-muted-foreground" />
                  <audio src={previewItem.previewUrl} controls autoPlay className="w-full max-w-sm" />
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
