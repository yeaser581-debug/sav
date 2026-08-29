'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { io } from 'socket.io-client';
import { Bell } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

type Notification = {
  id: number;
  title: string;
  message: string;
  isRead: boolean;
  link: string | null;
  createdAt: string;
};

export default function NotificationBell({ userId }: { userId: number }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    fetchNotifications();

    const socket = io();
    socket.on('new_notification', (targetUserId: number) => {
      if (targetUserId === userId) {
        fetchNotifications();
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [userId]);

  const fetchNotifications = async () => {
    const res = await fetch('/api/notifications');
    if (res.ok) {
      setNotifications(await res.json());
    }
  };

  const markAllAsRead = async () => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'all' })
    });
    setNotifications(n => n.map(x => ({ ...x, isRead: true })));
  };

  const markAsRead = async (id: number) => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    setNotifications(n => n.map(x => x.id === id ? { ...x, isRead: true } : x));
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger className={buttonVariants({ variant: "ghost", size: "icon", className: "relative text-muted-foreground hover:text-foreground" })}>
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge variant="destructive" className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center p-0 text-[10px]">
            {unreadCount}
          </Badge>
        )}
      </PopoverTrigger>

      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 pb-2">
          <h4 className="font-semibold leading-none tracking-tight">Notifications</h4>
          {unreadCount > 0 && (
            <Button variant="link" size="sm" onClick={markAllAsRead} className="h-auto p-0 text-xs text-foreground">
              Tout marquer comme lu
            </Button>
          )}
        </div>
        <Separator />
        <ScrollArea className="h-75">
          {notifications.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">Aucune notification.</p>
          ) : (
            <div className="flex flex-col">
              {notifications.map((n) => (
                <div key={n.id} className={`p-4 text-sm transition-colors hover:bg-accent/60 ${n.isRead ? 'opacity-70' : 'bg-accent/30'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <p className={`font-medium leading-none ${n.isRead ? 'text-muted-foreground' : 'text-foreground'}`}>
                        {n.title}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {n.message}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(n.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {!n.isRead && (
                      <div className="h-2 w-2 rounded-full bg-foreground shrink-0 mt-1" />
                    )}
                  </div>
                  {n.link && (
                    <Link
                      href={n.link}
                      onClick={() => { markAsRead(n.id); setIsOpen(false); }}
                      className="text-xs font-medium text-foreground hover:underline mt-2 inline-block"
                    >
                      Voir les détails →
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
