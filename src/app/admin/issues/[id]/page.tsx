'use client';

import { use } from 'react';
import { ConversationPane } from '@/components/admin/issues/ConversationPane';

export default function AdminIssueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const issueId = Number(resolvedParams.id);
  return <ConversationPane key={issueId} issueId={issueId} />;
}
