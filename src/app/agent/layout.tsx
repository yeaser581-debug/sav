import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import AgentSidebar from '@/components/agent/AgentSidebar';
import { InstallPrompt } from '@/components/InstallPrompt';

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const role = headersList.get('x-user-role');

  if (role !== 'agent') redirect('/login');

  const userName = headersList.get('x-user-email') ?? 'Agent';
  const userId = Number(headersList.get('x-user-id'));

  return (
    <div className="min-h-screen bg-background">
      <AgentSidebar userName={userName} userId={userId} />
      <main className="min-w-0 md:ml-64 p-4 md:p-6 text-foreground">
        {children}
      </main>
      <InstallPrompt />
    </div>
  );
}
