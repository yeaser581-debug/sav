import { Skeleton } from '@/components/ui/skeleton';

export default function AdminSidebarSkeleton() {
  return (
    <>
      <div className="md:hidden sticky top-0 z-40 flex items-center gap-2 h-14 px-3 border-b border-border bg-card">
        <Skeleton className="h-7 w-7 rounded-lg bg-muted" />
        <Skeleton className="h-4 w-24 bg-muted" />
      </div>
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-64 flex-col z-40 bg-card border-r border-border p-5 gap-2">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-9 w-9 rounded-xl bg-muted" />
          <Skeleton className="h-4 w-28 bg-muted" />
        </div>
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-9 w-full rounded-lg bg-muted" />
        ))}
      </aside>
    </>
  );
}
