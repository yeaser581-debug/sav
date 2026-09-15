// The single source of truth for how a claim moves through its lifecycle.
// Every route that changes a claim's status asks this module first; nothing
// that is not listed in TRANSITIONS is allowed. Keep this file free of
// database and framework imports so it stays exhaustively testable.

export const ISSUE_STATUSES = ['PENDING_AGENT', 'IN_PROGRESS', 'RESOLVED', 'CONFIRMED', 'REJECTED', 'DISPUTED'] as const;
export type IssueStatusValue = (typeof ISSUE_STATUSES)[number];

export const SEVERITIES = ['CRITICAL', 'MEDIUM', 'LOW'] as const;
export type SeverityValue = (typeof SEVERITIES)[number];

export const WORKFLOW_ROLES = ['admin', 'agent', 'client'] as const;
export type WorkflowRole = (typeof WORKFLOW_ROLES)[number];

export const MAX_REASON_LENGTH = 2000;

export const STATUS_LABELS: Record<IssueStatusValue, string> = {
  PENDING_AGENT: 'Nouvelle',
  IN_PROGRESS: 'En cours',
  RESOLVED: 'Résolue',
  CONFIRMED: 'Confirmée',
  DISPUTED: 'Contestée',
  REJECTED: 'Rejetée',
};

export type Actor = { role: WorkflowRole; id: number };

export type IssueSnapshot = {
  status: IssueStatusValue;
  clientId: number;
  agentId: number | null;
  severity: SeverityValue | null;
};

export type TransitionName =
  | 'claim'
  | 'assign'
  | 'reject'
  | 'resolve'
  | 'confirm'
  | 'dispute'
  | 'reopenDispute'
  | 'overrideRejection';

// 'update' is the general claim update route; 'resolve' is the dedicated
// route that requires proof of the intervention.
export type Channel = 'update' | 'resolve';

export type Transition = {
  readonly name: TransitionName;
  readonly role: WorkflowRole;
  readonly from: IssueStatusValue;
  readonly to: IssueStatusValue;
  readonly channel: Channel;
};

export const TRANSITIONS: readonly Transition[] = Object.freeze([
  { name: 'claim', role: 'agent', from: 'PENDING_AGENT', to: 'IN_PROGRESS', channel: 'update' },
  { name: 'assign', role: 'admin', from: 'PENDING_AGENT', to: 'IN_PROGRESS', channel: 'update' },
  { name: 'reject', role: 'agent', from: 'PENDING_AGENT', to: 'REJECTED', channel: 'update' },
  { name: 'reject', role: 'admin', from: 'PENDING_AGENT', to: 'REJECTED', channel: 'update' },
  { name: 'resolve', role: 'agent', from: 'IN_PROGRESS', to: 'RESOLVED', channel: 'resolve' },
  { name: 'confirm', role: 'client', from: 'RESOLVED', to: 'CONFIRMED', channel: 'update' },
  { name: 'dispute', role: 'client', from: 'RESOLVED', to: 'DISPUTED', channel: 'update' },
  { name: 'reopenDispute', role: 'admin', from: 'DISPUTED', to: 'IN_PROGRESS', channel: 'update' },
  { name: 'overrideRejection', role: 'admin', from: 'REJECTED', to: 'IN_PROGRESS', channel: 'update' },
] as const satisfies readonly Transition[]);

export type IssueChange = {
  status?: IssueStatusValue;
  severity?: SeverityValue;
  agentId?: number;
  rejectionReason?: string;
  disputeReason?: string;
};

// The row values the update must still find, compared atomically with the
// write so a claim changed by someone else in the meantime is not overwritten.
export type Expectation = {
  status?: IssueStatusValue;
  agentId?: number | null;
  clientId?: number;
};

export type IssueWrite = {
  status?: IssueStatusValue;
  agentId?: number;
  severity?: SeverityValue;
  rejectionReason?: string | null;
  disputeReason?: string | null;
  resolvedAt?: Date | null;
  closedAt?: Date | null;
};

export type Refusal = { outcome: 'refuse'; httpStatus: 400 | 403 | 409; message: string };

export type Decision =
  | {
      outcome: 'apply';
      transition: TransitionName | null;
      expect: Expectation;
      data: IssueWrite;
      agentToVerify: number | null;
    }
  | { outcome: 'noop' }
  | Refusal;

export type Permission = { ok: true } | { ok: false; httpStatus: 403 | 409; message: string };

const NOOP: Decision = { outcome: 'noop' };

function refuse(httpStatus: Refusal['httpStatus'], message: string): Refusal {
  return { outcome: 'refuse', httpStatus, message };
}

function apply(
  transition: TransitionName | null,
  expect: Expectation,
  data: IssueWrite,
  agentToVerify: number | null
): Decision {
  return { outcome: 'apply', transition, expect, data, agentToVerify };
}

export function isIssueStatus(value: unknown): value is IssueStatusValue {
  return typeof value === 'string' && (ISSUE_STATUSES as readonly string[]).includes(value);
}

export function isSeverity(value: unknown): value is SeverityValue {
  return typeof value === 'string' && (SEVERITIES as readonly string[]).includes(value);
}

export function isWorkflowRole(value: unknown): value is WorkflowRole {
  return typeof value === 'string' && (WORKFLOW_ROLES as readonly string[]).includes(value);
}

const CHANGE_KEYS = ['status', 'severity', 'agentId', 'rejectionReason', 'disputeReason'] as const;

export type ParsedChange = { ok: true; change: IssueChange } | { ok: false; message: string };

export function parseIssueChange(body: unknown): ParsedChange {
  const fail = (message: string): ParsedChange => ({ ok: false, message });

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return fail('Requête invalide.');
  }
  const record = body as Record<string, unknown>;

  const unknownKeys = Object.keys(record).filter(key => !(CHANGE_KEYS as readonly string[]).includes(key));
  if (unknownKeys.length > 0) {
    return fail(`Champ non modifiable : ${unknownKeys.join(', ')}.`);
  }

  const change: IssueChange = {};

  if (record.status !== undefined) {
    if (!isIssueStatus(record.status)) return fail('Statut inconnu.');
    change.status = record.status;
  }

  if (record.severity !== undefined) {
    if (!isSeverity(record.severity)) return fail('Priorité inconnue.');
    change.severity = record.severity;
  }

  if (record.agentId !== undefined) {
    if (typeof record.agentId !== 'number' || !Number.isInteger(record.agentId) || record.agentId <= 0) {
      return fail('Agent invalide.');
    }
    change.agentId = record.agentId;
  }

  for (const key of ['rejectionReason', 'disputeReason'] as const) {
    const value = record[key];
    if (value === undefined) continue;
    if (typeof value !== 'string') return fail('Le motif doit être un texte.');
    const trimmed = value.trim();
    if (trimmed.length > MAX_REASON_LENGTH) {
      return fail(`Le motif ne peut pas dépasser ${MAX_REASON_LENGTH} caractères.`);
    }
    if (trimmed) change[key] = trimmed;
  }

  if (record.rejectionReason !== undefined && change.status !== 'REJECTED') {
    return fail('Un motif de rejet accompagne uniquement un rejet.');
  }
  if (record.disputeReason !== undefined && change.status !== 'DISPUTED') {
    return fail('Un motif de contestation accompagne uniquement une contestation.');
  }
  if (change.agentId !== undefined && change.status !== 'IN_PROGRESS') {
    return fail("Un agent s'assigne uniquement en passant la réclamation en cours.");
  }
  if (change.status === undefined && change.severity === undefined) {
    return fail('Aucune modification demandée.');
  }

  return { ok: true, change };
}

// Whether this person may act on this claim at all, before asking whether
// the particular action is allowed. Mirrors what each role can see.
export function canAccessIssue(actor: Actor, issue: IssueSnapshot): boolean {
  switch (actor.role) {
    case 'admin':
      return true;
    case 'client':
      return issue.clientId === actor.id;
    case 'agent':
      return issue.agentId === actor.id || (issue.status === 'PENDING_AGENT' && issue.agentId === null);
  }
}

export function decideIssueChange(actor: Actor, issue: IssueSnapshot, change: IssueChange, now: Date): Decision {
  if (!canAccessIssue(actor, issue)) {
    return refuse(403, "Vous n'avez pas accès à cette réclamation.");
  }
  if (change.severity !== undefined && actor.role === 'client') {
    return refuse(403, "La priorité est fixée par l'équipe, pas par le résident.");
  }
  if (change.agentId !== undefined && actor.role !== 'admin') {
    return refuse(403, "Seule l'administration assigne un agent.");
  }

  if (change.status === undefined) {
    if (actor.role !== 'admin') {
      return refuse(403, "Seule l'administration peut modifier la priorité d'une réclamation déjà prise en charge.");
    }
    if (change.severity === issue.severity) return NOOP;
    return apply(null, {}, { severity: change.severity }, null);
  }

  return decideTransition(actor, issue, change.status, 'update', change, now);
}

export function decideResolution(actor: Actor, issue: IssueSnapshot, now: Date): Decision {
  if (!canAccessIssue(actor, issue)) {
    return refuse(403, 'Seul l’agent assigné peut résoudre cette réclamation.');
  }
  return decideTransition(actor, issue, 'RESOLVED', 'resolve', {}, now);
}

function decideTransition(
  actor: Actor,
  issue: IssueSnapshot,
  to: IssueStatusValue,
  channel: Channel,
  change: IssueChange,
  now: Date
): Decision {
  const forRole = TRANSITIONS.filter(t => t.role === actor.role && t.to === to);
  if (forRole.length === 0) {
    return refuse(403, `Action non autorisée : vous ne pouvez pas passer une réclamation en « ${STATUS_LABELS[to]} ».`);
  }

  const viaChannel = forRole.filter(t => t.channel === channel);
  if (viaChannel.length === 0) {
    return refuse(
      403,
      to === 'RESOLVED'
        ? 'Une réclamation se résout uniquement en joignant les preuves de l’intervention.'
        : 'Action non autorisée par ce moyen.'
    );
  }

  if (issue.status === to) {
    const replay = decideReplay(actor, issue, to, change);
    if (replay) return replay;
  }

  const transition = viaChannel.find(t => t.from === issue.status);
  if (!transition) {
    return refuse(
      409,
      `Impossible de passer une réclamation « ${STATUS_LABELS[issue.status]} » en « ${STATUS_LABELS[to]} ».`
    );
  }

  if (actor.role === 'agent' && change.severity !== undefined && transition.name !== 'claim') {
    return refuse(403, "La priorité ne peut plus être modifiée par l'agent après la prise en charge.");
  }

  const severity = actor.role === 'admin' && change.severity !== undefined ? { severity: change.severity } : {};

  switch (transition.name) {
    case 'claim': {
      if (issue.agentId !== null) return refuse(409, 'Cette réclamation a déjà été prise en charge.');
      if (change.severity === undefined) {
        return refuse(400, 'Qualifiez la priorité avant de prendre en charge la réclamation.');
      }
      return apply(
        'claim',
        { status: 'PENDING_AGENT', agentId: null },
        { status: 'IN_PROGRESS', agentId: actor.id, severity: change.severity, resolvedAt: null },
        actor.id
      );
    }

    case 'assign': {
      if (issue.agentId !== null) return refuse(409, 'Cette réclamation a déjà un agent.');
      if (change.agentId === undefined) return refuse(400, 'Choisissez un agent à assigner.');
      return apply(
        'assign',
        { status: 'PENDING_AGENT', agentId: null },
        { status: 'IN_PROGRESS', agentId: change.agentId, resolvedAt: null, ...severity },
        change.agentId
      );
    }

    case 'reject': {
      if (actor.role === 'agent' && issue.agentId !== null) {
        return refuse(409, 'Cette réclamation a déjà été prise en charge.');
      }
      if (!change.rejectionReason) return refuse(400, 'Le motif du rejet est obligatoire.');
      return apply(
        'reject',
        actor.role === 'agent' ? { status: 'PENDING_AGENT', agentId: null } : { status: 'PENDING_AGENT' },
        { status: 'REJECTED', rejectionReason: change.rejectionReason, ...severity },
        null
      );
    }

    case 'resolve': {
      if (issue.agentId !== actor.id) return refuse(403, 'Seul l’agent assigné peut résoudre cette réclamation.');
      return apply(
        'resolve',
        { status: 'IN_PROGRESS', agentId: actor.id },
        { status: 'RESOLVED', resolvedAt: now },
        null
      );
    }

    case 'confirm':
      return apply(
        'confirm',
        { status: 'RESOLVED', clientId: actor.id },
        { status: 'CONFIRMED', closedAt: now },
        null
      );

    case 'dispute': {
      if (!change.disputeReason) {
        return refuse(400, 'Expliquez ce qui ne va pas pour contester la résolution.');
      }
      return apply(
        'dispute',
        { status: 'RESOLVED', clientId: actor.id },
        { status: 'DISPUTED', disputeReason: change.disputeReason },
        null
      );
    }

    case 'reopenDispute': {
      const agentId = change.agentId ?? issue.agentId;
      if (agentId === null) return refuse(400, 'Choisissez un agent pour reprendre le dossier.');
      return apply(
        'reopenDispute',
        { status: 'DISPUTED' },
        { status: 'IN_PROGRESS', agentId, disputeReason: null, resolvedAt: null, ...severity },
        agentId
      );
    }

    case 'overrideRejection': {
      const agentId = change.agentId ?? issue.agentId;
      if (agentId === null) return refuse(400, 'Choisissez un agent pour reprendre la réclamation.');
      return apply(
        'overrideRejection',
        { status: 'REJECTED' },
        { status: 'IN_PROGRESS', agentId, rejectionReason: null, resolvedAt: null, closedAt: null, ...severity },
        agentId
      );
    }
  }
}

// A request asking for the status the claim already has. When it is a
// repeat of something this person was allowed to do, succeed without doing
// anything again: the offline outbox replays requests whose response was
// lost, and those replays must not fail or trigger notifications twice.
function decideReplay(
  actor: Actor,
  issue: IssueSnapshot,
  to: IssueStatusValue,
  change: IssueChange
): Decision | null {
  const severityUnchanged = change.severity === undefined || change.severity === issue.severity;

  if (actor.role === 'client' && (to === 'CONFIRMED' || to === 'DISPUTED')) {
    return NOOP;
  }

  if (actor.role === 'agent' && to === 'IN_PROGRESS' && issue.agentId === actor.id) {
    return severityUnchanged
      ? NOOP
      : refuse(403, "La priorité ne peut plus être modifiée par l'agent après la prise en charge.");
  }

  if (actor.role === 'admin' && to === 'IN_PROGRESS') {
    const requested = change.agentId ?? issue.agentId;
    if (requested !== issue.agentId) {
      return refuse(409, 'Cette réclamation est déjà en cours avec un autre agent.');
    }
    return severityUnchanged ? NOOP : apply(null, {}, { severity: change.severity }, null);
  }

  if (actor.role === 'admin' && to === 'REJECTED') {
    return severityUnchanged ? NOOP : apply(null, {}, { severity: change.severity }, null);
  }

  return null;
}

// The transitions this person could start right now, given the claim's
// current state. Built on the same decision function the routes use, so it
// cannot drift from what the server accepts.
export function availableTransitions(actor: Actor, issue: IssueSnapshot, now: Date = new Date()): TransitionName[] {
  const names = new Set<TransitionName>();

  for (const t of TRANSITIONS) {
    if (t.role !== actor.role || t.from !== issue.status) continue;

    const probe: IssueChange = { status: t.to };
    if (t.name === 'claim') probe.severity = 'MEDIUM';
    if (t.name === 'assign' || t.name === 'reopenDispute' || t.name === 'overrideRejection') {
      probe.agentId = Number.MAX_SAFE_INTEGER;
    }
    if (t.name === 'reject') probe.rejectionReason = 'motif';
    if (t.name === 'dispute') probe.disputeReason = 'motif';

    const decision = t.channel === 'resolve'
      ? decideResolution(actor, issue, now)
      : decideIssueChange(actor, issue, probe, now);

    if (decision.outcome === 'apply' && decision.transition === t.name) names.add(t.name);
  }

  return [...names];
}

export function decideVisitScheduling(actor: Actor, issue: IssueSnapshot): Permission {
  if (actor.role !== 'agent' || issue.agentId !== actor.id) {
    return { ok: false, httpStatus: 403, message: 'Seul l’agent assigné peut planifier une visite.' };
  }
  if (issue.status !== 'IN_PROGRESS') {
    return {
      ok: false,
      httpStatus: 409,
      message: 'Une visite se planifie uniquement pendant l’intervention, quand la réclamation est en cours.',
    };
  }
  return { ok: true };
}

export const CLOSED_FOR_RESIDENT: readonly IssueStatusValue[] = ['CONFIRMED', 'REJECTED'];

export function decideMessagePosting(role: WorkflowRole, status: IssueStatusValue): Permission {
  if (role === 'agent') {
    return { ok: false, httpStatus: 403, message: "La messagerie est réservée au résident et à l'administration." };
  }
  if (role === 'client' && CLOSED_FOR_RESIDENT.includes(status)) {
    return { ok: false, httpStatus: 409, message: 'Cette réclamation est clôturée. Les messages sont désactivés.' };
  }
  return { ok: true };
}
