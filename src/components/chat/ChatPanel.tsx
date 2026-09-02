'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { showUndoToast } from '@/components/ui/undo-toast';
import { outboxFetch, subscribe } from '@/lib/outbox';
import { MessageSquare, Send, Paperclip, Mic, X, Trash2, Clock } from 'lucide-react';

export type ChatMessage = {
  id: number;
  message: string;
  senderType: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
  createdAt: string;
};

function formatDuration(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function MessageMedia({ msg }: { msg: ChatMessage }) {
  const [open, setOpen] = useState(false);
  if (!msg.mediaUrl) return null;

  if (msg.mediaType === 'PHOTO') {
    return (
      <>
        <button type="button" onClick={() => setOpen(true)} className="block max-w-[220px] rounded-lg overflow-hidden">
          <img src={msg.mediaUrl} alt="Photo" className="w-full h-auto object-cover" />
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

  // AUDIO (voice note)
  return (
    <audio src={msg.mediaUrl} controls className="h-10 max-w-[220px]" />
  );
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
}) {
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [micError, setMicError] = useState('');
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set());
  const [pendingMessages, setPendingMessages] = useState<{ id: string; content: string; createdAt: string }[]>([]);

  const socketRef = useRef<Socket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingThrottleRef = useRef(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issueId]);

  useEffect(() => {
    return subscribe((event) => {
      if (event.type !== 'sent' || event.meta?.kind !== 'message' || event.meta.issueId !== issueId) return;
      setPendingMessages(prev => prev.filter(m => m.id !== event.id));
      onRefresh();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issueId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, otherTyping, pendingMessages]);

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

      if (result.res.ok) afterSent(await result.res.json());
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
      if (res.ok) afterSent(await res.json());
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
      recordTimerRef.current = setInterval(() => setRecordSeconds(s => s + 1), 1000);
    } catch {
      setMicError('Micro indisponible ou accès refusé.');
    }
  };

  const stopRecording = (cancel = false) => {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    setRecording(false);
    if (cancel) {
      recordedChunksRef.current = [];
      // Detach the handler so a cancelled recording never gets sent.
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

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.filter(m => !hiddenIds.has(m.id)).length === 0 && pendingMessages.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-xs text-muted-foreground font-medium">Aucun message pour l&apos;instant.</p>
          </div>
        ) : (
          messages.filter(m => !hiddenIds.has(m.id)).map(msg => {
            const isMe = msg.senderType === myRole;
            const initials = msg.senderType === 'ADMIN' ? 'AD' : 'RE';

            return (
              <div key={msg.id} className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                {!isMe && (
                  <Avatar className="h-7 w-7 shrink-0 mt-1">
                    <AvatarFallback className="bg-accent text-foreground text-[10px] font-bold">{initials}</AvatarFallback>
                  </Avatar>
                )}
                <div className="space-y-1 max-w-[80%]">
                  <div className={`p-3 text-xs leading-relaxed font-medium ${
                    isMe
                      ? 'bg-primary text-primary-foreground rounded-2xl rounded-tr-sm'
                      : 'bg-muted border border-border text-foreground rounded-2xl rounded-tl-sm'
                  }`}>
                    {!isMe && (
                      <p className="text-[9px] font-bold mb-1.5 uppercase tracking-wider text-muted-foreground">
                        {msg.senderType === 'ADMIN' ? 'Administration' : 'Résident'}
                      </p>
                    )}
                    {msg.mediaUrl && <MessageMedia msg={msg} />}
                    {msg.message && <p className={`whitespace-pre-wrap ${msg.mediaUrl ? 'mt-2' : ''}`}>{msg.message}</p>}
                  </div>
                  <div className={`flex items-center gap-1.5 px-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <p className="text-[9px] text-muted-foreground">
                      {new Date(msg.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {isMe && (
                      <button
                        type="button"
                        onClick={() => handleDeleteMessage(msg)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        aria-label="Supprimer le message"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {pendingMessages.map(msg => (
          <div key={msg.id} className="flex gap-2.5 flex-row-reverse">
            <div className="space-y-1 max-w-[80%]">
              <div className="p-3 text-xs leading-relaxed font-medium bg-primary/60 text-primary-foreground rounded-2xl rounded-tr-sm">
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
              <div className="flex items-center gap-1 px-1 justify-end text-muted-foreground">
                <Clock className="h-2.5 w-2.5" />
                <p className="text-[9px]">En attente d&apos;envoi</p>
              </div>
            </div>
          </div>
        ))}

        {otherTyping && (
          <div className="flex gap-2.5 flex-row">
            <Avatar className="h-7 w-7 shrink-0 mt-1">
              <AvatarFallback className="bg-accent text-foreground text-[10px] font-bold">
                {myRole === 'CLIENT' ? 'AD' : 'RE'}
              </AvatarFallback>
            </Avatar>
            <div className="bg-muted border border-border rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" />
            </div>
          </div>
        )}
      </div>

      <form onSubmit={sendMessage} className="p-4 border-t border-border bg-muted/40 shrink-0 rounded-b-xl">
        {disabled ? (
          <p className="text-[10px] text-muted-foreground text-center">{disabledReason}</p>
        ) : recording ? (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => stopRecording(true)}
              className="h-9 w-9 p-0 shrink-0 text-muted-foreground hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </Button>
            <div className="flex-1 flex items-center gap-2 bg-card border border-border rounded-lg h-9 px-3">
              <span className="h-2 w-2 rounded-full bg-destructive animate-pulse shrink-0" />
              <span className="text-xs font-mono text-foreground">{formatDuration(recordSeconds)}</span>
              <span className="text-[10px] text-muted-foreground">Enregistrement du message vocal...</span>
            </div>
            <Button
              type="button"
              onClick={() => stopRecording(false)}
              className="h-9 w-9 p-0 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
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
