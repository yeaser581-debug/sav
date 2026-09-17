'use client';

import { useParams } from 'next/navigation';
import { ClientProfileView } from '@/components/admin/clients/ClientProfileView';

export default function AdminClientPage() {
  const { id } = useParams<{ id: string }>();
  const clientId = /^\d{1,15}$/.test(id) ? Number(id) : 0;

  // key: moving between two clients starts from a clean page.
  return <ClientProfileView key={clientId} clientId={clientId} />;
}
