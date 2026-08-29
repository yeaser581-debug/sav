'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Film, Music, FileText } from 'lucide-react';

export type IssueMediaItem = { id: number; type: string; url: string };

export function MediaGallery({ media }: { media: IssueMediaItem[] }) {
  const [active, setActive] = useState<IssueMediaItem | null>(null);

  if (!media || media.length === 0) return null;

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {media.map(m => {
          const isImage = m.type === 'PHOTO';
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setActive(m)}
              className="relative group aspect-square rounded-xl overflow-hidden border border-border bg-muted flex flex-col items-center justify-center p-2 hover:border-foreground/20 active:scale-[0.98] transition-all duration-150"
            >
              {isImage ? (
                <img src={m.url} alt="Pièce jointe" className="w-full h-full object-cover rounded-lg" />
              ) : (
                <div className="flex flex-col items-center gap-2">
                  {m.type === 'VIDEO' ? <Film className="h-7 w-7 text-muted-foreground" /> :
                   m.type === 'AUDIO' ? <Music className="h-7 w-7 text-muted-foreground" /> :
                   <FileText className="h-7 w-7 text-muted-foreground" />}
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase">{m.type}</span>
                </div>
              )}
              <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-xs font-semibold text-foreground">
                Voir
              </div>
            </button>
          );
        })}
      </div>

      <Dialog open={!!active} onOpenChange={(open) => !open && setActive(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Pièce jointe</DialogTitle>
          </DialogHeader>
          {active && (
            <div className="flex items-center justify-center bg-muted rounded-lg overflow-hidden">
              {active.type === 'PHOTO' && (
                <img src={active.url} alt="Pièce jointe" className="max-h-[70vh] w-full object-contain" />
              )}
              {active.type === 'VIDEO' && (
                <video src={active.url} controls autoPlay className="max-h-[70vh] w-full" />
              )}
              {active.type === 'AUDIO' && (
                <audio src={active.url} controls autoPlay className="w-full max-w-sm my-8" />
              )}
              {active.type !== 'PHOTO' && active.type !== 'VIDEO' && active.type !== 'AUDIO' && (
                <a href={active.url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-foreground hover:underline p-8">
                  Ouvrir le fichier dans un nouvel onglet
                </a>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
