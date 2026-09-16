'use client';

import { usePathname } from 'next/navigation';
import { InboxListPane } from '@/components/admin/issues/InboxListPane';

export default function AdminIssuesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const match = pathname.match(/^\/admin\/issues\/(\d+)/);
  const activeId = match ? Number(match[1]) : undefined;

  return (
    // The negative margin cancels the page padding, so on desktop this pane
    // starts at the top of the window and fills it exactly. On mobile it also
    // clears the sticky bar above it (3.5rem) plus that padding (2rem).
    <div className="flex h-[calc(100dvh-5.5rem)] md:h-dvh -m-4 md:-m-6 border-t border-border">
      <div className={`w-full md:w-80 lg:w-96 shrink-0 border-r border-border bg-card ${activeId ? 'hidden md:flex md:flex-col' : 'flex flex-col'}`}>
        <InboxListPane activeId={activeId} />
      </div>
      <div className={`flex-1 min-w-0 ${activeId ? 'flex flex-col' : 'hidden md:flex md:flex-col'}`}>
        {children}
      </div>
    </div>
  );
}
