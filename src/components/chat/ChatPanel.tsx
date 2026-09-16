'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { showUndoToast } from '@/components/ui/undo-toast';
import { VoiceNote } from '@/components/ui/voice-note';
import { toast } from 'sonner';
import { outboxFetch, subscribe } from '@/lib/outbox';
import { MessageSquare, Send, Paperclip, Mic, X, Trash2, Clock, Check, CheckCheck } from 'lucide-react';
import { adminHasUnread, clientHasUnread, isMessageSeen, latestMessageAt, announceIssueRead } from '@/lib/read-state';

export type ChatMessage = {
  id: number;
  message: string;
  senderType: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
  createdAt: string;
};

const MAX_RECORD_SECONDS = 180;
const METER_BARS = 32;

function formatDuration(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function MessageStamp({
  createdAt,
  onDelete,
  seen,
  block = false,
}: {
  createdAt: string;
  onDelete?: () => void;
  seen?: boolean;
  block?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] text-muted-foreground ${
        block ? 'mt-1 flex justify-end' : 'float-right ml-3 mt-1'
      }`}
    >
      {new Date(createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
      {seen !== undefined && (
        seen ? (
          <CheckCheck className="h-3.5 w-3.5 text-primary" aria-label="Vu" />
        ) : (
          <Check className="h-3.5 w-3.5 text-muted-foreground/70" aria-label="Envoyé" />
        )
      )}
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="-mr-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:bg-destructive/10 focus-visible:text-destructive motion-reduce:transition-none"
          aria-label="Supprimer le message"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}

function MessageMedia({ msg }: { msg: ChatMessage }) {
  const [open, setOpen] = useState(false);
  if (!msg.mediaUrl) return null;

  if (msg.mediaType === 'PHOTO') {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="block aspect-square w-40 max-w-full overflow-hidden rounded-lg border border-border"
        >
          <img src={msg.mediaUrl} alt="Photo" className="h-full w-full object-cover" />
        </button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Photo</DialogTitle>
            </DialogHeader>
            <img src={msg.mediaUrl} alt="Photo" className="max-h-[70vh] w-full object-contain rounded-lg" />
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (msg.mediaType === 'VIDEO') {
    return (
      <video src={msg.mediaUrl} controls className="max-w-[220px] rounded-lg" />
    );
  }

  return <VoiceNote src={msg.mediaUrl} />;
}

export function ChatPanel({
  issueId,
  myRole,
  messages,
  onRefresh,
  disabled = false,
  disabledReason,
  title = 'Discussion',
  subtitle,
  className = 'h-[70vh] lg:h-[600px]',
  leadMessage,
  readState,
}: {
  issueId: number;
  myRole: 'CLIENT' | 'ADMIN';
  messages: ChatMessage[];
  onRefresh: () => void;
  disabled?: boolean;
  disabledReason?: string;
  title?: string;
  subtitle?: string;
  className?: string;
  leadMessage?: { content: string; senderLabel: string; createdAt: string };
  readState?: { adminLastReadAt: string | null; clientLastReadAt: string | null };
}) {
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [micError, setMicError] = useState('');
  const [levels, setLevels] = useState<number[]>(() => Array(METER_BARS).fill(0));
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set());
  const [pendingMessages, setPendingMessages] = useState<{ id: string; content: string; createdAt: string }[]>([]);

  const socketRef = useRef<Socket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingThrottleRef = useRef(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const meterFrameRef = useRef<number | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const deleteTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const otherLabel = myRole === 'CLIENT' ? 'l\'administration' : 'le résident';

  useEffect(() => {
    const socket = io();
    socketRef.current = socket;
    socket.emit('join_issue', issueId);
    socket.on('new_message', () => onRefresh());
    socket.on('message_deleted', () => onRefresh());
    socket.on('messages_seen', () => onRefresh());
    socket.on('user_typing', () => {
      setOtherTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setOtherTyping(false), 3000);
    });

    return () => {
      socket.disconnect();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      deleteTimersRef.current.forEach(t => clearTimeout(t));
      deleteTimersRef.current.clear();
      // Leaving mid-recording must release the microphone, not keep it live.
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      if (meterFrameRef.current !== null) cancelAnimationFrame(meterFrameRef.current);
      void audioContextRef.current?.close().catch(() => {});
      audioContextRef.current = null;
      const recorder = mediaRecorderRef.current;
      if (recorder) {
        recorder.onstop = null; // nothing left to send the take to
        recorder.stream.getTracks().forEach(t => t.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issueId]);

  useEffect(() => {
    return subscribe((event) => {
      if (event.type === 'queued' || event.meta?.kind !== 'message' || event.meta.issueId !== issueId) return;
      setPendingMessages(prev => prev.filter(m => m.id !== event.id));
      if (event.type === 'failed') {
        toast.error('Un message écrit hors ligne n’a pas pu être envoyé. La réclamation a peut-être été clôturée entre-temps.');
      }
      onRefresh();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issueId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, otherTyping, pendingMessages]);

  const markingRef = useRef(false);
  const adminReadAt = readState?.adminLastReadAt ?? null;
  const clientReadAt = readState?.clientLastReadAt ?? null;
  const otherPartyReadAt = myRole === 'ADMIN' ? clientReadAt : adminReadAt;

  useEffect(() => {
    if (!readState) return;

    const markRead = async () => {
      if (document.visibilityState !== 'visible' || markingRef.current) return;

      const unread = myRole === 'ADMIN'
        ? adminHasUnread({ adminLastReadAt: adminReadAt, latestClientMessageAt: latestMessageAt(messages, 'CLIENT') })
        : clientHasUnread({ clientLastReadAt: clientReadAt, latestAdminMessageAt: latestMessageAt(messages, 'ADMIN') });
      if (!unread) return;

      markingRef.current = true;
      try {
        const res = await fetch(`/api/issues/${issueId}/read`, { method: 'POST' });
        if (!res.ok) return;
        const data = await res.json();
        if (!data.changed) return;
        socketRef.current?.emit('mark_seen', { issueId });
        if (myRole === 'ADMIN') announceIssueRead(issueId);
        onRefresh();
      } catch {
      } finally {
        markingRef.current = false;
      }
    };

    void markRead();
    document.addEventListener('visibilitychange', markRead);
    return () => document.removeEventListener('visibilitychange', markRead);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issueId, myRole, messages, adminReadAt, clientReadAt, readState === undefined]);

  const notifyTyping = () => {
    const now = Date.now();
    if (now - typingThrottleRef.current < 1500) return;
    typingThrottleRef.current = now;
    socketRef.current?.emit('typing', { issueId });
  };

  const afterSent = (data: { targetUserIds?: number[] }) => {
    socketRef.current?.emit('send_message', { issueId });
    data.targetUserIds?.forEach((uid) => socketRef.current?.emit('send_notification', uid));
    onRefresh();
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending || disabled) return;
    const content = newMessage.trim();
    setNewMessage('');
    setSending(true);
    try {
      const clientRequestId = crypto.randomUUID();
      const result = await outboxFetch(
        `/api/issues/${issueId}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, clientRequestId }),
        },
        clientRequestId,
        { kind: 'message', issueId }
      );

      if (result.status === 'queued') {
        setPendingMessages(prev => [...prev, { id: clientRequestId, content, createdAt: new Date().toISOString() }]);
        return;
      }

      if (result.res.ok) {
        afterSent(await result.res.json());
      } else {
        const data = await result.res.json().catch(() => ({}));
        toast.error(data.error || 'Le message n’a pas pu être envoyé.');
        setNewMessage(current => current || content);
        onRefresh();
      }
    } finally {
      setSending(false);
    }
  };

  const sendFile = async (file: File) => {
    if (disabled) return;
    setSending(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/issues/${issueId}/messages`, { method: 'POST', body: form });
      if (res.ok) {
        afterSent(await res.json());
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Le fichier n’a pas pu être envoyé.');
        onRefresh();
      }
    } catch {
      toast.error('Erreur de connexion.');
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMessage = (msg: ChatMessage) => {
    setHiddenIds(prev => new Set(prev).add(msg.id));
    showUndoToast({
      message: 'Message supprimé',
      duration: 5000,
      onUndo: () => {
        const t = deleteTimersRef.current.get(msg.id);
        if (t) {
          clearTimeout(t);
          deleteTimersRef.current.delete(msg.id);
        }
        setHiddenIds(prev => {
          const next = new Set(prev);
          next.delete(msg.id);
          return next;
        });
      },
    });
    const timer = setTimeout(async () => {
      deleteTimersRef.current.delete(msg.id);
      const res = await fetch(`/api/issues/${issueId}/messages/${msg.id}`, { method: 'DELETE' });
      if (res.ok) {
        socketRef.current?.emit('delete_message', { issueId });
        onRefresh();
      }
    }, 5000);
    deleteTimersRef.current.set(msg.id, timer);
  };

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) sendFile(file);
  };

  // Draws the microphone's own level, so it is obvious the recording is picking
  // something up rather than only that time is passing.
  const startMeter = (stream: MediaStream) => {
    const context = new AudioContext();
    audioContextRef.current = context;
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    context.createMediaStreamSource(stream).connect(analyser);

    const samples = new Uint8Array(analyser.frequencyBinCount);
    let lastFrame = 0;

    const tick = (now: number) => {
      meterFrameRef.current = requestAnimationFrame(tick);
      if (now - lastFrame < 70) return;
      lastFrame = now;

      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (const sample of samples) {
        const deviation = (sample - 128) / 128;
        sum += deviation * deviation;
      }
      const level = Math.min(1, Math.sqrt(sum / samples.length) * 3.2);
      setLevels(prev => [...prev.slice(1), level]);
    };

    meterFrameRef.current = requestAnimationFrame(tick);
  };

  const stopMeter = () => {
    if (meterFrameRef.current !== null) cancelAnimationFrame(meterFrameRef.current);
    meterFrameRef.current = null;
    void audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
    setLevels(Array(METER_BARS).fill(0));
  };

  const startRecording = async () => {
    setMicError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordedChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
        if (blob.size > 0 && recordedChunksRef.current.length) {
          const file = new File([blob], `vocal-${Date.now()}.webm`, { type: 'audio/webm' });
          sendFile(file);
        }
        recordedChunksRef.current = [];
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setRecordSeconds(0);
      startMeter(stream);
      recordTimerRef.current = setInterval(() => {
        setRecordSeconds(s => {
          // Stop on its own rather than let the upload be refused for size.
          if (s + 1 >= MAX_RECORD_SECONDS) stopRecording(false);
          return s + 1;
        });
      }, 1000);
    } catch {
      setMicError('Micro indisponible ou accès refusé.');
    }
  };

  const stopRecording = (cancel = false) => {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    stopMeter();
    setRecording(false);
    if (cancel) {
      recordedChunksRef.current = [];
      if (mediaRecorderRef.current) mediaRecorderRef.current.onstop = () => {
        mediaRecorderRef.current?.stream.getTracks().forEach(t => t.stop());
      };
    }
    mediaRecorderRef.current?.stop();
  };

  return (
    <Card className={`bg-card border-border flex flex-col shadow-sm ${className}`}>
      <CardHeader className="border-b border-border p-4 shrink-0 flex flex-row items-center gap-2.5">
        <MessageSquare className="h-4 w-4 text-foreground" />
        <div>
          <CardTitle className="text-sm font-bold text-foreground">{title}</CardTitle>
          {subtitle && <CardDescription className="text-[10px] text-muted-foreground">{subtitle}</CardDescription>}
        </div>
      </CardHeader>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="flex min-h-full flex-col justify-end gap-3.5">
        {!leadMessage && messages.filter(m => !hiddenIds.has(m.id)).length === 0 && pendingMessages.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-xs text-muted-foreground font-medium">Aucun message pour l&apos;instant.</p>
          </div>
        ) : (
          <>
          {leadMessage && (
            <div className="flex flex-row items-end gap-2">
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarFallback className="bg-accent text-accent-foreground text-[10px] font-bold">
                  {leadMessage.senderLabel.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flow-root min-w-30 max-w-[80%] rounded-2xl rounded-bl-sm border border-border bg-muted px-3 pt-2.5 pb-2 text-xs leading-relaxed font-medium text-foreground">
                <p className="mb-1 text-[11px] font-bold text-muted-foreground">
                  Réclamation initiale — {leadMessage.senderLabel}
                </p>
                <MessageStamp createdAt={leadMessage.createdAt} />
                <p className="whitespace-pre-wrap">{leadMessage.content}</p>
              </div>
            </div>
          )}
          {messages.filter(m => !hiddenIds.has(m.id)).map(msg => {
            const isMe = msg.senderType === myRole;

            return (
              <div key={msg.id} className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                {!isMe && (
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarFallback className="bg-accent text-accent-foreground text-[10px] font-bold">
                      {msg.senderType === 'ADMIN' ? 'AD' : 'RE'}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div className="min-w-30 max-w-[80%]">
                  <div className={`flow-root px-3 pt-2.5 pb-2 text-xs leading-relaxed font-medium text-foreground ${
                    isMe
                      ? 'bg-accent border border-primary/20 rounded-2xl rounded-br-sm'
                      : 'bg-muted border border-border rounded-2xl rounded-bl-sm'
                  }`}>
                    {msg.message && (
                      <MessageStamp
                        createdAt={msg.createdAt}
                        onDelete={isMe ? () => handleDeleteMessage(msg) : undefined}
                        seen={isMe && readState ? isMessageSeen(msg.createdAt, otherPartyReadAt) : undefined}
                      />
                    )}
                    {msg.mediaUrl && <MessageMedia msg={msg} />}
                    {msg.message && <p className={`whitespace-pre-wrap ${msg.mediaUrl ? 'mt-2' : ''}`}>{msg.message}</p>}
                    {!msg.message && (
                      <MessageStamp
                        block
                        createdAt={msg.createdAt}
                        onDelete={isMe ? () => handleDeleteMessage(msg) : undefined}
                        seen={isMe && readState ? isMessageSeen(msg.createdAt, otherPartyReadAt) : undefined}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          </>
        )}

        {pendingMessages.map(msg => (
          <div key={msg.id} className="flex flex-row-reverse items-end gap-2">
            <div className="flow-root min-w-30 max-w-[80%] rounded-2xl rounded-br-sm border border-primary/20 bg-accent/60 px-3 pt-2.5 pb-2 text-xs leading-relaxed font-medium text-foreground">
              <span className="float-right ml-3 mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <Clock className="h-2.5 w-2.5" />
                En attente
              </span>
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}

        {otherTyping && (
          <div className="flex flex-row items-end gap-2">
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarFallback className="bg-accent text-accent-foreground text-[10px] font-bold">
                {myRole === 'CLIENT' ? 'AD' : 'RE'}
              </AvatarFallback>
            </Avatar>
            <div className="bg-muted border border-border rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" />
            </div>
          </div>
        )}
        </div>
      </div>

      <form onSubmit={sendMessage} className="p-4 border-t border-border bg-muted/40 shrink-0 rounded-b-xl">
        {disabled ? (
          <p className="text-[10px] text-muted-foreground text-center">{disabledReason}</p>
        ) : recording ? (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => stopRecording(true)}
              title="Annuler l'enregistrement"
              aria-label="Annuler l'enregistrement"
              className="h-9 w-9 p-0 shrink-0 rounded-full border-border text-muted-foreground hover:text-destructive hover:border-destructive hover:bg-transparent"
            >
              <X className="h-4 w-4" />
            </Button>
            <div
              role="status"
              className="flex-1 min-w-0 flex items-center gap-2.5 h-9 px-3 rounded-full bg-destructive-wash border border-destructive/30"
            >
              <span className="h-2 w-2 rounded-full bg-destructive shrink-0 animate-pulse motion-reduce:animate-none" />
              <span className="text-xs font-mono tabular-nums text-destructive shrink-0">
                {formatDuration(recordSeconds)}
              </span>
              {/* Live microphone level: shows the recording is picking sound up. */}
              <span aria-hidden className="flex-1 min-w-0 flex items-center justify-end gap-0.5 h-4 overflow-hidden">
                {levels.map((level, i) => (
                  <span
                    key={i}
                    className="w-0.5 rounded-full bg-destructive shrink-0"
                    style={{ height: `${2 + level * 14}px`, opacity: 0.3 + level * 0.7 }}
                  />
                ))}
              </span>
              {recordSeconds >= MAX_RECORD_SECONDS - 30 && (
                <span className="text-[10px] text-destructive shrink-0">
                  il reste {formatDuration(MAX_RECORD_SECONDS - recordSeconds)}
                </span>
              )}
            </div>
            <Button
              type="button"
              onClick={() => stopRecording(false)}
              title="Envoyer le message vocal"
              aria-label="Envoyer le message vocal"
              className="h-9 w-9 p-0 shrink-0 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div className="flex gap-2 items-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*,audio/*"
              className="hidden"
              onChange={handleFilePick}
            />
            <Button
              type="button"
              variant="ghost"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending}
              className="h-9 w-9 p-0 shrink-0 text-muted-foreground hover:text-foreground"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Input
              type="text"
              value={newMessage}
              onChange={e => { setNewMessage(e.target.value); notifyTyping(); }}
              placeholder="Écrivez votre message..."
              className="flex-1 bg-card border-border text-foreground placeholder-muted-foreground h-9 rounded-lg text-xs"
              disabled={sending}
            />
            {newMessage.trim() ? (
              <Button
                type="submit"
                disabled={sending}
                className="bg-primary text-primary-foreground hover:bg-primary/90 px-3.5 h-9 rounded-lg transition-all shadow-md shrink-0"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={startRecording}
                disabled={sending}
                className="h-9 w-9 p-0 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
              >
                <Mic className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
        {micError && <p className="text-[10px] text-destructive text-center mt-2">{micError}</p>}
      </form>
    </Card>
  );
}
