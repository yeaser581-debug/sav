import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import ClientSidebar from '@/components/client/ClientSidebar';
import ActivationHeader from '@/components/client/ActivationHeader';
import { InstallPrompt } from '@/components/InstallPrompt';

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const role = headersList.get('x-user-role');

  if (role !== 'client') redirect('/login');

  const userName = headersList.get('x-user-email') ?? 'Client';
  const userId = Number(headersList.get('x-user-id'));
  const mustSetPassword = headersList.get('x-must-set-password') === 'true';

  if (mustSetPassword) {
    return (
      <div className="min-h-screen bg-background">
        <ActivationHeader />
        <main className="p-4 md:p-6 text-foreground">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <ClientSidebar userName={userName} userId={userId} />
      <main className="min-w-0 md:ml-64 p-4 pb-24 md:p-6 md:pb-6 text-foreground">
        {children}
      </main>
      <InstallPrompt />
    </div>
  );
}
