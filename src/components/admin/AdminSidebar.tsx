'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { io } from 'socket.io-client';
import { toast } from 'sonner';
import NotificationBell from '@/components/NotificationBell';
import { ThemeToggle } from '@/components/ThemeToggle';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  AlertCircle,
  Users,
  Building2,
  MapPinned,
  FileText,
  HardHat,
  LogOut,
  Menu,
  Terminal,
  History,
  ShieldCheck,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { InstallMenuItem } from '@/components/InstallMenuItem';
import { PushToggle } from '@/components/PushToggle';
import { logout } from '@/lib/session';
import { CommandSearch, SearchTrigger } from '@/components/admin/CommandSearch';

const MINI_KEY = 'admin-sidebar';
const MINI_EVENT = 'admin-sidebar-change';

// Whether the desktop sidebar is collapsed lives on the document element, so
// the CSS variable that sizes both the sidebar and the page can follow it. The
// layout restores the saved choice before the first paint.
function subscribeToMini(onChange: () => void) {
  window.addEventListener(MINI_EVENT, onChange);
  return () => window.removeEventListener(MINI_EVENT, onChange);
}

function readMini() {
  return document.documentElement.dataset.adminSidebar === 'mini';
}

function useMiniSidebar() {
  const mini = useSyncExternalStore(subscribeToMini, readMini, () => false);

  const toggle = useCallback(() => {
    const next = readMini() ? 'full' : 'mini';
    document.documentElement.dataset.adminSidebar = next;
    try {
      localStorage.setItem(MINI_KEY, next);
    } catch {
      // Storage blocked: the choice simply does not survive a reload.
    }
    window.dispatchEvent(new Event(MINI_EVENT));
  }, []);

  return { mini, toggle };
}

const nav = [
  { href: '/admin', label: 'Tableau de bord', icon: LayoutDashboard, exact: true },
  { href: '/admin/issues', label: 'Réclamations', icon: AlertCircle },
  { href: '/admin/agents', label: 'Agents', icon: HardHat },
  { href: '/admin/areas', label: 'Zones', icon: MapPinned },
  { href: '/admin/clients', label: 'Clients', icon: Users },
  { href: '/admin/buildings', label: 'Immeubles', icon: Building2 },
  { href: '/admin/contract', label: 'Contrat SAV', icon: FileText },
];

const superAdminNav = [
  { href: '/admin/admins', label: 'Administrateurs', icon: ShieldCheck },
  { href: '/admin/history', label: 'Historique', icon: History },
  { href: '/admin/api-tester', label: 'API Tester', icon: Terminal },
];

export default function AdminSidebar({ userName, userId, isSuperAdmin }: { userName: string; userId: number; isSuperAdmin?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { mini, toggle: toggleMini } = useMiniSidebar();

  const openSearch = useCallback(() => {
    setOpen(false);
    setSearchOpen(true);
  }, []);

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    const socket = io();
    socket.on('force_logout', (targetUserId: number) => {
      if (targetUserId === userId) {
        socket.disconnect();
        toast.error('Votre compte a été désactivé. Déconnexion...');
        logout('disabled');
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [userId]);

  const initials = userName
    .split('@')[0]
    .split('.')
    .map(s => s[0]?.toUpperCase())
    .slice(0, 2)
    .join('');

  const navList = (mini: boolean) => (
    <nav className={cn('flex-1 space-y-0.5 overflow-y-auto p-3', mini && 'px-2')}>
      {nav.map(item => {
        const Icon = item.icon;
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link key={item.href} href={item.href} title={mini ? item.label : undefined}>
            <div className={cn(
              'flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-colors duration-150',
              mini ? 'justify-center px-2' : 'px-3',
              active
                ? 'bg-accent text-foreground font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
            )}>
              <Icon className="h-4 w-4 shrink-0" />
              {!mini && <span>{item.label}</span>}
            </div>
          </Link>
        );
      })}

      {isSuperAdmin && (
        <>
          <div className={cn('flex items-center gap-1.5 pb-1.5 pt-4', mini ? 'justify-center px-2' : 'px-3')}>
            <ShieldCheck className="h-3 w-3 text-warning" />
            {!mini && <span className="text-[10px] font-bold uppercase tracking-wider text-warning">Super Admin</span>}
          </div>
          {superAdminNav.map(item => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} title={mini ? item.label : undefined}>
                <div className={cn(
                  'flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-colors duration-150',
                  mini ? 'justify-center px-2' : 'px-3',
                  active
                    ? 'bg-warning-wash text-warning font-semibold border border-warning/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
                )}>
                  <Icon className="h-4 w-4 shrink-0" />
                  {!mini && <span>{item.label}</span>}
                </div>
              </Link>
            );
          })}
        </>
      )}
    </nav>
  );

  const userFooter = (mini: boolean) => (
    <div className={mini ? 'flex flex-col items-center gap-2 p-2' : 'p-4'}>
      {mini ? (
        <Avatar className="h-8 w-8" title={userName}>
          <AvatarFallback className="bg-accent text-foreground text-xs font-bold">{initials || 'AD'}</AvatarFallback>
        </Avatar>
      ) : (
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-accent text-foreground text-xs font-bold">{initials || 'AD'}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-foreground text-sm font-medium truncate">{userName.split('@')[0]}</p>
            <p className="text-muted-foreground text-xs truncate">{userName}</p>
          </div>
        </div>
      )}
      {!mini && (
        <>
          <PushToggle />
          <InstallMenuItem />
        </>
      )}
      <Button
        variant="ghost"
        onClick={() => logout()}
        title={mini ? 'Déconnexion' : undefined}
        className={cn(
          'h-8 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive',
          mini ? 'w-9 justify-center px-0' : 'w-full justify-start gap-2 px-3',
        )}
      >
        <LogOut className="h-3.5 w-3.5" />
        {!mini && 'Déconnexion'}
      </Button>
    </div>
  );

  return (
    <>
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
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={openSearch}
            className="text-muted-foreground hover:text-foreground"
          >
            <Search className="h-4 w-4" />
            <span className="sr-only">Rechercher</span>
          </Button>
          <ThemeToggle className="h-8 w-8 text-muted-foreground hover:text-foreground" />
          <NotificationBell userId={userId} />
        </div>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="p-0 gap-0 flex flex-col">
          <div className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-foreground flex items-center justify-center shrink-0">
                <span className="text-background text-xs font-bold tracking-wider">AS</span>
              </div>
              <div>
                <p className="text-foreground font-semibold text-sm leading-none">After-Sales</p>
                <p className="text-muted-foreground text-[11px] mt-1 font-medium uppercase tracking-wider">Admin</p>
              </div>
            </div>
          </div>
          <div className="px-3 pb-3">
            <SearchTrigger onClick={openSearch} />
          </div>
          <Separator />
          {navList(false)}
          <Separator />
          {userFooter(false)}
        </SheetContent>
      </Sheet>

      <aside className="fixed left-0 top-0 z-40 hidden h-full w-(--admin-sidebar-width) flex-col border-r border-border bg-card transition-[width] duration-200 motion-reduce:transition-none md:flex">
        <div className={mini ? 'flex flex-col items-center gap-3 p-3' : 'p-5'}>
          <div className={cn('flex items-center gap-3', mini && 'flex-col')}>
            <div className="w-9 h-9 rounded-xl bg-foreground flex items-center justify-center shrink-0">
              <span className="text-background text-xs font-bold tracking-wider">AS</span>
            </div>
            {!mini && (
              <div>
                <p className="text-foreground font-semibold text-sm leading-none">After-Sales</p>
                <p className="text-muted-foreground text-[11px] mt-1 font-medium uppercase tracking-wider">Admin</p>
              </div>
            )}
            <div className={cn('flex items-center gap-1', mini ? 'flex-col' : 'ml-auto')}>
              <ThemeToggle className="h-8 w-8 text-muted-foreground hover:text-foreground" />
              <NotificationBell userId={userId} />
            </div>
          </div>
          {mini ? (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={openSearch}
              title="Rechercher (Ctrl K)"
              className="text-muted-foreground hover:text-foreground"
            >
              <Search className="h-4 w-4" />
              <span className="sr-only">Rechercher</span>
            </Button>
          ) : (
            <SearchTrigger onClick={openSearch} className="mt-4" />
          )}
        </div>

        <Separator />
        {navList(mini)}
        <Separator />
        {userFooter(mini)}

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={toggleMini}
          aria-pressed={mini}
          title={mini ? 'Déployer le menu' : 'Réduire le menu'}
          className="absolute -right-3 top-20 h-6 w-6 rounded-full border border-border bg-card text-muted-foreground shadow-sm hover:text-foreground"
        >
          {mini ? <PanelLeftOpen className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
          <span className="sr-only">{mini ? 'Déployer le menu' : 'Réduire le menu'}</span>
        </Button>
      </aside>

      <CommandSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
