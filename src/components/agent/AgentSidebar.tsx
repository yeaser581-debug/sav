'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import NotificationBell from '@/components/NotificationBell';
import { ThemeToggle } from '@/components/ThemeToggle';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  AlertCircle,
  Building2,
  Users,
  Calendar,
  LogOut,
  Menu,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Sheet, SheetContent } from '@/components/ui/sheet';

const nav = [
  { href: '/agent', label: 'Tableau de bord', icon: LayoutDashboard, exact: true },
  { href: '/agent/issues', label: 'Réclamations', icon: AlertCircle },
  { href: '/agent/visits', label: 'Mes visites', icon: Calendar },
  { href: '/agent/buildings', label: 'Immeubles', icon: Building2 },
  { href: '/agent/clients', label: 'Clients', icon: Users },
];

export default function AgentSidebar({ userName, userId }: { userName: string; userId: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => { setOpen(false); }, [pathname]);

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  const initials = userName
    .split('@')[0]
    .split('.')
    .map(s => s[0]?.toUpperCase())
    .slice(0, 2)
    .join('') || userName.slice(0, 2).toUpperCase();

  const navList = (
    <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
      {nav.map(item => {
        const Icon = item.icon;
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link key={item.href} href={item.href}>
            <div className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150',
              active
                ? 'bg-accent text-foreground font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
            )}>
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </div>
          </Link>
        );
      })}
    </nav>
  );

  const userFooter = (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-3">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-accent text-foreground text-xs font-bold">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-foreground text-sm font-medium truncate">{userName.split('@')[0]}</p>
          <p className="text-muted-foreground text-xs truncate">{userName}</p>
        </div>
      </div>
      <Button
        variant="ghost"
        onClick={logout}
        className="w-full justify-start gap-2 h-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 px-3 text-sm"
      >
        <LogOut className="h-3.5 w-3.5" />
        Déconnexion
      </Button>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden sticky top-0 z-40 flex items-center justify-between h-14 px-3 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setOpen(true)}
            className="text-muted-foreground hover:text-foreground"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="w-7 h-7 rounded-lg bg-foreground flex items-center justify-center shrink-0">
            <span className="text-background text-[10px] font-bold tracking-wider">AS</span>
          </div>
          <p className="text-foreground font-semibold text-sm">After-Sales</p>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle className="h-8 w-8 text-muted-foreground hover:text-foreground" />
          <NotificationBell userId={userId} />
        </div>
      </div>

      {/* Mobile drawer */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="p-0 gap-0 flex flex-col">
          <div className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-foreground flex items-center justify-center shrink-0">
                <span className="text-background text-xs font-bold tracking-wider">AS</span>
              </div>
              <div>
                <p className="text-foreground font-semibold text-sm leading-none">After-Sales</p>
                <p className="text-muted-foreground text-[11px] mt-1 font-medium uppercase tracking-wider">Agent</p>
              </div>
            </div>
          </div>
          <Separator />
          {navList}
          <Separator />
          {userFooter}
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-64 flex-col z-40 bg-card border-r border-border">
        {/* Brand */}
        <div className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-foreground flex items-center justify-center shrink-0">
              <span className="text-background text-xs font-bold tracking-wider">AS</span>
            </div>
            <div>
              <p className="text-foreground font-semibold text-sm leading-none">After-Sales</p>
              <p className="text-muted-foreground text-[11px] mt-1 font-medium uppercase tracking-wider">Agent</p>
            </div>
            <div className="ml-auto flex items-center gap-1">
              <ThemeToggle className="h-8 w-8 text-muted-foreground hover:text-foreground" />
              <NotificationBell userId={userId} />
            </div>
          </div>
        </div>

        <Separator />
        {navList}
        <Separator />
        {userFooter}
      </aside>
    </>
  );
}
