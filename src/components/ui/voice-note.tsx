'use client';

import { useEffect, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';

const BAR_COUNT = 32;

export function pseudoWaveform(seed: string): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;

  const bars: number[] = [];
  for (let i = 0; i < BAR_COUNT; i++) {
    h = (h * 1664525 + 1013904223) >>> 0;
    bars.push(0.25 + ((h >>> 8) % 1000) / 1000 * 0.75);
  }
  return bars;
}

export function clock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function VoiceNote({ src, className = '' }: { src: string; className?: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  const bars = pseudoWaveform(src);
  const progress = duration > 0 ? current / duration : 0;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => setCurrent(audio.currentTime);
    const onMeta = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onEnd = () => { setPlaying(false); setCurrent(0); };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('durationchange', onMeta);
    audio.addEventListener('ended', onEnd);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('durationchange', onMeta);
      audio.removeEventListener('ended', onEnd);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
    };
  }, []);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play().catch(() => setPlaying(false));
    } else {
      audio.pause();
    }
  };

  const seekTo = (ratio: number) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    audio.currentTime = Math.min(Math.max(ratio, 0), 1) * duration;
    setCurrent(audio.currentTime);
  };

  return (
    <div className={`flex w-[220px] max-w-full items-center gap-2.5 ${className}`}>
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />

      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Mettre en pause' : 'Écouter le message vocal'}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-90 motion-reduce:transition-none"
      >
        {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="ml-0.5 h-3.5 w-3.5" />}
      </button>

      <button
        type="button"
        onClick={e => {
          const rect = e.currentTarget.getBoundingClientRect();
          seekTo((e.clientX - rect.left) / rect.width);
        }}
        aria-label="Se déplacer dans le message vocal"
        className="flex h-8 flex-1 items-end gap-[2px] pb-0.5"
      >
        {bars.map((height, i) => (
          <span
            key={i}
            className={`w-full rounded-full transition-colors duration-150 motion-reduce:transition-none ${
              i / BAR_COUNT <= progress ? 'bg-primary' : 'bg-muted-foreground/30'
            }`}
            style={{ height: `${Math.round(height * 22)}px` }}
          />
        ))}
      </button>

      <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
        {clock(playing || current > 0 ? current : duration)}
      </span>
    </div>
  );
}
