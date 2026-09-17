// Shapes of the client directory endpoints as they arrive in the browser
// (dates are ISO strings there).

import type { ClaimStats, HistoryFilter } from '@/lib/client-search';

export type { ClaimStats, HistoryFilter };

export type ClientBase = {
  id: number;
  name: string | null;
  login: string;
  unitNumber: string | null;
  phone: string | null;
  email: string | null;
  qrUsedAt: string | null;
  mustSetPassword: boolean;
  buildingId: number;
  createdAt: string;
};

export type ClientRow = ClientBase & {
  building: { id: number; name: string } | null;
  claims: { total: number; open: number; lastAt: string | null };
};

export type ClientListResponse = { clients: ClientRow[]; total: number; page: number; limit: number };

export type ClientProfileResponse = {
  client: ClientBase & {
    building: {
      id: number;
      name: string;
      address: string | null;
      area: { id: number; name: string; agent: { id: number; name: string } | null } | null;
    } | null;
  };
  stats: ClaimStats;
};

export type HistoryIssue = {
  id: number;
  status: string;
  severity: string | null;
  description: string | null;
  createdAt: string;
  resolvedAt: string | null;
  agent: { name: string } | null;
  lastMessage: { message: string; mediaType: string | null; senderType: string; createdAt: string } | null;
};

export type HistoryResponse = { issues: HistoryIssue[]; total: number; page: number; limit: number; filter: HistoryFilter };

export type SearchResponse = {
  query: string;
  clients: { id: number; name: string | null; login: string; unitNumber: string | null; phone: string | null; building: { name: string } | null }[];
  issues: {
    id: number;
    status: string;
    description: string | null;
    createdAt: string;
    client: { id: number; name: string | null; login: string; unitNumber: string | null };
  }[];
};
