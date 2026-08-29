import { Suspense } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminSidebarSkeleton from '@/components/admin/AdminSidebarSkeleton';
import { InstallPrompt } from '@/components/InstallPrompt';

// Isolated in its own component (and Suspense boundary) because it reads
// headers() — a runtime API. If this lived directly in AdminLayout, the whole
// layout render would block on it, and admin/loading.tsx would never get a
// chance to show its fallback for {children} while the page itself loads.
async function AdminSidebarServer() {
  const headersList = await headers();
  const role = headersList.get('x-user-role');

  if (role !== 'admin') redirect('/login');

  const userName = headersList.get('x-user-email') ?? 'Admin';
  const userId = Number(headersList.get('x-user-id'));
  const isSuperAdmin = headersList.get('x-user-super-admin') === 'true';

  return <AdminSidebar userName={userName} userId={userId} isSuperAdmin={isSuperAdmin} />;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={<AdminSidebarSkeleton />}>
        <AdminSidebarServer />
      </Suspense>
      <main className="min-w-0 md:ml-64 p-4 md:p-6 text-foreground">
        {children}
      </main>
      <InstallPrompt />
    </div>
  );
}
