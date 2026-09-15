import { describe, it, expect } from 'vitest';
import { IssueStatus, Severity } from '@prisma/client';
import {
  ISSUE_STATUSES,
  SEVERITIES,
  STATUS_LABELS,
  TRANSITIONS,
  MAX_REASON_LENGTH,
  availableTransitions,
  canAccessIssue,
  decideIssueChange,
  decideMessagePosting,
  decideResolution,
  decideVisitScheduling,
  parseIssueChange,
  type Actor,
  type Decision,
  type IssueChange,
  type IssueSnapshot,
  type IssueStatusValue,
  type WorkflowRole,
} from '@/lib/issue-workflow';
import { statusLabel } from '@/components/ui/status-badge';

const NOW = new Date('2026-09-15T10:00:00Z');

const CLIENT_ID = 3;
const AGENT_ID = 7;
const OTHER_AGENT_ID = 9;

const actors: Record<WorkflowRole, Actor> = {
  admin: { role: 'admin', id: 1 },
  agent: { role: 'agent', id: AGENT_ID },
  client: { role: 'client', id: CLIENT_ID },
};

// A claim the way it realistically exists in each status: unassigned while
// pending or rejected, held by agent 7 otherwise.
function claimIn(status: IssueStatusValue, overrides: Partial<IssueSnapshot> = {}): IssueSnapshot {
  const unassigned = status === 'PENDING_AGENT' || status === 'REJECTED';
  return { status, clientId: CLIENT_ID, agentId: unassigned ? null : AGENT_ID, severity: 'MEDIUM', ...overrides };
}

// The fully-specified request each role would send to reach a status, so a
// refusal in the matrix reflects the rule, not a missing field.
function requestFor(role: WorkflowRole, issue: IssueSnapshot, to: IssueStatusValue): IssueChange {
  const change: IssueChange = { status: to };
  if (to === 'REJECTED') change.rejectionReason = 'Hors garantie';
  if (to === 'DISPUTED') change.disputeReason = 'Toujours cassé';
  if (to === 'IN_PROGRESS' && role === 'agent') change.severity = 'MEDIUM';
  if (to === 'IN_PROGRESS' && role === 'admin') change.agentId = issue.agentId ?? OTHER_AGENT_ID;
  return change;
}

function summarize(decision: Decision): string {
  if (decision.outcome === 'apply') return decision.transition ?? 'apply';
  if (decision.outcome === 'noop') return 'noop';
  return String(decision.httpStatus);
}

const COLUMNS: IssueStatusValue[] = ['PENDING_AGENT', 'IN_PROGRESS', 'RESOLVED', 'CONFIRMED', 'REJECTED', 'DISPUTED'];

// Written out by hand on purpose. Changing a rule in issue-workflow.ts must
// fail this test until the table below is updated deliberately.
//             to: PENDING_AGENT  IN_PROGRESS          RESOLVED  CONFIRMED  REJECTED   DISPUTED
const EXPECTED: Record<WorkflowRole, Record<IssueStatusValue, string[]>> = {
  client: {
    PENDING_AGENT: ['403', '403', '403', '409', '403', '409'],
    IN_PROGRESS: ['403', '403', '403', '409', '403', '409'],
    RESOLVED: ['403', '403', '403', 'confirm', '403', 'dispute'],
    CONFIRMED: ['403', '403', '403', 'noop', '403', '409'],
    REJECTED: ['403', '403', '403', '409', '403', '409'],
    DISPUTED: ['403', '403', '403', '409', '403', 'noop'],
  },
  agent: {
    PENDING_AGENT: ['403', 'claim', '403', '403', 'reject', '403'],
    IN_PROGRESS: ['403', 'noop', '403', '403', '409', '403'],
    RESOLVED: ['403', '409', '403', '403', '409', '403'],
    CONFIRMED: ['403', '409', '403', '403', '409', '403'],
    REJECTED: ['403', '403', '403', '403', '403', '403'],
    DISPUTED: ['403', '409', '403', '403', '409', '403'],
  },
  admin: {
    PENDING_AGENT: ['403', 'assign', '403', '403', 'reject', '403'],
    IN_PROGRESS: ['403', 'noop', '403', '403', '409', '403'],
    RESOLVED: ['403', '409', '403', '403', '409', '403'],
    CONFIRMED: ['403', '409', '403', '403', '409', '403'],
    REJECTED: ['403', 'overrideRejection', '403', '403', 'noop', '403'],
    DISPUTED: ['403', 'reopenDispute', '403', '403', '409', '403'],
  },
};

describe('status change matrix (every role × current status × requested status)', () => {
  for (const role of Object.keys(EXPECTED) as WorkflowRole[]) {
    for (const from of COLUMNS) {
      COLUMNS.forEach((to, column) => {
        const expected = EXPECTED[role][from][column];
        it(`${role}: ${from} → ${to} is ${expected}`, () => {
          const issue = claimIn(from);
          const decision = decideIssueChange(actors[role], issue, requestFor(role, issue, to), NOW);
          expect(summarize(decision)).toBe(expected);
        });
      });
    }
  }
});

describe('resolution matrix (proof route)', () => {
  const EXPECTED_RESOLVE: Record<WorkflowRole, Record<IssueStatusValue, string>> = {
    agent: { PENDING_AGENT: '409', IN_PROGRESS: 'resolve', RESOLVED: '409', CONFIRMED: '409', REJECTED: '403', DISPUTED: '409' },
    admin: { PENDING_AGENT: '403', IN_PROGRESS: '403', RESOLVED: '403', CONFIRMED: '403', REJECTED: '403', DISPUTED: '403' },
    client: { PENDING_AGENT: '403', IN_PROGRESS: '403', RESOLVED: '403', CONFIRMED: '403', REJECTED: '403', DISPUTED: '403' },
  };

  for (const role of Object.keys(EXPECTED_RESOLVE) as WorkflowRole[]) {
    for (const from of COLUMNS) {
      const expected = EXPECTED_RESOLVE[role][from];
      it(`${role}: resolving a ${from} claim is ${expected}`, () => {
        expect(summarize(decideResolution(actors[role], claimIn(from), NOW))).toBe(expected);
      });
    }
  }

  it('refuses an agent who is not the one assigned', () => {
    const issue = claimIn('IN_PROGRESS', { agentId: OTHER_AGENT_ID });
    expect(summarize(decideResolution(actors.agent, issue, NOW))).toBe('403');
  });

  it('stamps the resolution time and guards on the assigned agent', () => {
    const decision = decideResolution(actors.agent, claimIn('IN_PROGRESS'), NOW);
    expect(decision).toMatchObject({
      outcome: 'apply',
      expect: { status: 'IN_PROGRESS', agentId: AGENT_ID },
      data: { status: 'RESOLVED', resolvedAt: NOW },
    });
  });
});

describe('the transition table itself', () => {
  it('lists each role/from/to combination at most once', () => {
    const keys = TRANSITIONS.map(t => `${t.role}:${t.from}:${t.to}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('never leads back to pending', () => {
    expect(TRANSITIONS.filter(t => t.to === 'PENDING_AGENT')).toEqual([]);
  });

  it('has no transition from a status to itself', () => {
    expect(TRANSITIONS.filter(t => t.from === t.to)).toEqual([]);
  });

  it('treats a confirmed claim as final for everyone', () => {
    expect(TRANSITIONS.filter(t => t.from === 'CONFIRMED')).toEqual([]);
  });

  it('lets only an admin bring a rejected claim back', () => {
    expect(TRANSITIONS.filter(t => t.from === 'REJECTED').map(t => t.role)).toEqual(['admin']);
  });

  it('only resolves through the proof route', () => {
    const intoResolved = TRANSITIONS.filter(t => t.to === 'RESOLVED');
    expect(intoResolved.map(t => t.channel)).toEqual(['resolve']);
  });

  it('can reach every status from a new claim', () => {
    const reached = new Set<IssueStatusValue>(['PENDING_AGENT']);
    let grew = true;
    while (grew) {
      grew = false;
      for (const t of TRANSITIONS) {
        if (reached.has(t.from) && !reached.has(t.to)) {
          reached.add(t.to);
          grew = true;
        }
      }
    }
    expect([...reached].sort()).toEqual([...ISSUE_STATUSES].sort());
  });

  it('cannot be modified at runtime', () => {
    expect(Object.isFrozen(TRANSITIONS)).toBe(true);
  });
});

describe('stays in step with the database and the screens', () => {
  it('knows exactly the statuses the database defines', () => {
    expect([...ISSUE_STATUSES].sort()).toEqual(Object.values(IssueStatus).sort());
  });

  it('knows exactly the severities the database defines', () => {
    expect([...SEVERITIES].sort()).toEqual(Object.values(Severity).sort());
  });

  it('uses the same status wording as the badges', () => {
    for (const status of ISSUE_STATUSES) {
      expect(STATUS_LABELS[status]).toBe(statusLabel(status));
    }
  });
});

describe('what each screen offers is accepted by the server', () => {
  // Every status-changing action a screen performs today, sent from the state
  // in which that screen shows the button. If a rule tightens and breaks a
  // screen, this fails.
  const SCREEN_ACTIONS: { screen: string; actor: Actor; issue: IssueSnapshot; body: unknown; transition: string }[] = [
    { screen: 'agent · Accepter et gérer', actor: actors.agent, issue: claimIn('PENDING_AGENT'), body: { status: 'IN_PROGRESS', severity: 'CRITICAL' }, transition: 'claim' },
    { screen: 'agent · Rejeter', actor: actors.agent, issue: claimIn('PENDING_AGENT'), body: { status: 'REJECTED', rejectionReason: 'Hors garantie' }, transition: 'reject' },
    { screen: 'résident · Confirmer', actor: actors.client, issue: claimIn('RESOLVED'), body: { status: 'CONFIRMED' }, transition: 'confirm' },
    { screen: 'résident · Contester', actor: actors.client, issue: claimIn('RESOLVED'), body: { status: 'DISPUTED', disputeReason: 'Fuite toujours là' }, transition: 'dispute' },
    { screen: 'admin · Assigner un agent', actor: actors.admin, issue: claimIn('PENDING_AGENT'), body: { agentId: OTHER_AGENT_ID, status: 'IN_PROGRESS' }, transition: 'assign' },
    { screen: 'admin · Assigner (réclamation rejetée)', actor: actors.admin, issue: claimIn('REJECTED'), body: { agentId: OTHER_AGENT_ID, status: 'IN_PROGRESS' }, transition: 'overrideRejection' },
    { screen: 'admin · Rejeter sans assigner', actor: actors.admin, issue: claimIn('PENDING_AGENT'), body: { status: 'REJECTED', rejectionReason: 'Doublon' }, transition: 'reject' },
    { screen: 'admin · Rouvrir (même agent)', actor: actors.admin, issue: claimIn('DISPUTED'), body: { agentId: AGENT_ID, status: 'IN_PROGRESS' }, transition: 'reopenDispute' },
    { screen: 'admin · Rouvrir (autre agent)', actor: actors.admin, issue: claimIn('DISPUTED'), body: { agentId: OTHER_AGENT_ID, status: 'IN_PROGRESS' }, transition: 'reopenDispute' },
  ];

  for (const action of SCREEN_ACTIONS) {
    it(action.screen, () => {
      const parsed = parseIssueChange(action.body);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) return;
      expect(summarize(decideIssueChange(action.actor, action.issue, parsed.change, NOW))).toBe(action.transition);
    });
  }

  it('admin · Priorité dropdown, whatever the status', () => {
    for (const status of ISSUE_STATUSES) {
      const parsed = parseIssueChange({ severity: 'LOW' });
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) return;
      expect(decideIssueChange(actors.admin, claimIn(status), parsed.change, NOW).outcome).toBe('apply');
    }
  });

  it('agent · Planifier une visite while in progress', () => {
    expect(decideVisitScheduling(actors.agent, claimIn('IN_PROGRESS'))).toEqual({ ok: true });
  });

  it('agent · Résoudre while in progress', () => {
    expect(summarize(decideResolution(actors.agent, claimIn('IN_PROGRESS'), NOW))).toBe('resolve');
  });
});

describe('what each transition writes', () => {
  it('claim assigns the agent, records the priority, and requires the claim still be unassigned', () => {
    const decision = decideIssueChange(actors.agent, claimIn('PENDING_AGENT', { severity: null }), { status: 'IN_PROGRESS', severity: 'CRITICAL' }, NOW);
    expect(decision).toMatchObject({
      outcome: 'apply',
      expect: { status: 'PENDING_AGENT', agentId: null },
      data: { status: 'IN_PROGRESS', agentId: AGENT_ID, severity: 'CRITICAL', resolvedAt: null },
      agentToVerify: AGENT_ID,
    });
  });

  it('assign asks the route to verify the chosen agent exists', () => {
    const decision = decideIssueChange(actors.admin, claimIn('PENDING_AGENT'), { status: 'IN_PROGRESS', agentId: OTHER_AGENT_ID }, NOW);
    expect(decision).toMatchObject({ outcome: 'apply', agentToVerify: OTHER_AGENT_ID, data: { agentId: OTHER_AGENT_ID } });
  });

  it('confirm closes the claim, only for its owner', () => {
    const decision = decideIssueChange(actors.client, claimIn('RESOLVED'), { status: 'CONFIRMED' }, NOW);
    expect(decision).toMatchObject({
      outcome: 'apply',
      expect: { status: 'RESOLVED', clientId: CLIENT_ID },
      data: { status: 'CONFIRMED', closedAt: NOW },
    });
  });

  it('dispute records the reason', () => {
    const decision = decideIssueChange(actors.client, claimIn('RESOLVED'), { status: 'DISPUTED', disputeReason: 'Pas réparé' }, NOW);
    expect(decision).toMatchObject({ outcome: 'apply', data: { status: 'DISPUTED', disputeReason: 'Pas réparé' } });
  });

  it('reopening a dispute clears the reason and the resolution, keeping the agent by default', () => {
    const decision = decideIssueChange(actors.admin, claimIn('DISPUTED'), { status: 'IN_PROGRESS' }, NOW);
    expect(decision).toMatchObject({
      outcome: 'apply',
      transition: 'reopenDispute',
      expect: { status: 'DISPUTED' },
      data: { status: 'IN_PROGRESS', agentId: AGENT_ID, disputeReason: null, resolvedAt: null },
    });
  });

  it('overriding a rejection clears the rejection reason', () => {
    const decision = decideIssueChange(actors.admin, claimIn('REJECTED'), { status: 'IN_PROGRESS', agentId: OTHER_AGENT_ID }, NOW);
    expect(decision).toMatchObject({
      outcome: 'apply',
      transition: 'overrideRejection',
      expect: { status: 'REJECTED' },
      data: { status: 'IN_PROGRESS', agentId: OTHER_AGENT_ID, rejectionReason: null, resolvedAt: null, closedAt: null },
    });
  });

  it('an agent rejection requires the claim still be unassigned; an admin one only that it is pending', () => {
    const byAgent = decideIssueChange(actors.agent, claimIn('PENDING_AGENT'), { status: 'REJECTED', rejectionReason: 'x' }, NOW);
    const byAdmin = decideIssueChange(actors.admin, claimIn('PENDING_AGENT'), { status: 'REJECTED', rejectionReason: 'x' }, NOW);
    expect(byAgent).toMatchObject({ expect: { status: 'PENDING_AGENT', agentId: null } });
    expect(byAdmin).toMatchObject({ expect: { status: 'PENDING_AGENT' } });
    expect(byAdmin.outcome === 'apply' && 'agentId' in byAdmin.expect).toBe(false);
  });
});

describe('required information', () => {
  it('refuses a claim without a priority', () => {
    expect(summarize(decideIssueChange(actors.agent, claimIn('PENDING_AGENT'), { status: 'IN_PROGRESS' }, NOW))).toBe('400');
  });

  it('refuses an assignment without an agent', () => {
    expect(summarize(decideIssueChange(actors.admin, claimIn('PENDING_AGENT'), { status: 'IN_PROGRESS' }, NOW))).toBe('400');
  });

  it('refuses a rejection without a reason, from either role', () => {
    expect(summarize(decideIssueChange(actors.agent, claimIn('PENDING_AGENT'), { status: 'REJECTED' }, NOW))).toBe('400');
    expect(summarize(decideIssueChange(actors.admin, claimIn('PENDING_AGENT'), { status: 'REJECTED' }, NOW))).toBe('400');
  });

  it('refuses a dispute without a reason', () => {
    expect(summarize(decideIssueChange(actors.client, claimIn('RESOLVED'), { status: 'DISPUTED' }, NOW))).toBe('400');
  });

  it('refuses to reopen a dispute when no agent is known', () => {
    const issue = claimIn('DISPUTED', { agentId: null });
    expect(summarize(decideIssueChange(actors.admin, issue, { status: 'IN_PROGRESS' }, NOW))).toBe('400');
  });

  it('refuses to override a rejection without choosing an agent', () => {
    expect(summarize(decideIssueChange(actors.admin, claimIn('REJECTED'), { status: 'IN_PROGRESS' }, NOW))).toBe('400');
  });
});

describe('claims already taken', () => {
  it('an agent cannot claim one that already has an agent', () => {
    const issue = claimIn('PENDING_AGENT', { agentId: OTHER_AGENT_ID });
    expect(summarize(decideIssueChange(actors.agent, issue, { status: 'IN_PROGRESS', severity: 'LOW' }, NOW))).toBe('403');
  });

  it('an admin cannot assign over an existing agent', () => {
    const issue = claimIn('PENDING_AGENT', { agentId: AGENT_ID });
    expect(summarize(decideIssueChange(actors.admin, issue, { status: 'IN_PROGRESS', agentId: OTHER_AGENT_ID }, NOW))).toBe('409');
  });

  it('an agent cannot reject a claim someone already holds', () => {
    const issue = claimIn('PENDING_AGENT', { agentId: AGENT_ID });
    expect(summarize(decideIssueChange(actors.agent, issue, { status: 'REJECTED', rejectionReason: 'x' }, NOW))).toBe('409');
  });

  it('an admin cannot swap the agent on a claim already in progress', () => {
    const decision = decideIssueChange(actors.admin, claimIn('IN_PROGRESS'), { status: 'IN_PROGRESS', agentId: OTHER_AGENT_ID }, NOW);
    expect(summarize(decision)).toBe('409');
  });
});

describe('priority', () => {
  it('an admin can change it in any status', () => {
    for (const status of ISSUE_STATUSES) {
      const decision = decideIssueChange(actors.admin, claimIn(status), { severity: 'CRITICAL' }, NOW);
      expect(decision).toMatchObject({ outcome: 'apply', transition: null, data: { severity: 'CRITICAL' }, expect: {} });
    }
  });

  it('setting the priority it already has does nothing', () => {
    expect(summarize(decideIssueChange(actors.admin, claimIn('IN_PROGRESS'), { severity: 'MEDIUM' }, NOW))).toBe('noop');
  });

  it('an agent cannot change it once the claim is theirs', () => {
    expect(summarize(decideIssueChange(actors.agent, claimIn('IN_PROGRESS'), { severity: 'LOW' }, NOW))).toBe('403');
  });

  it('an agent cannot slip a priority change into a repeated claim', () => {
    expect(summarize(decideIssueChange(actors.agent, claimIn('IN_PROGRESS'), { status: 'IN_PROGRESS', severity: 'LOW' }, NOW))).toBe('403');
  });

  it('an agent cannot attach a priority to a rejection', () => {
    const decision = decideIssueChange(actors.agent, claimIn('PENDING_AGENT'), { status: 'REJECTED', rejectionReason: 'x', severity: 'LOW' }, NOW);
    expect(summarize(decision)).toBe('403');
  });

  it('a resident can never set it', () => {
    expect(summarize(decideIssueChange(actors.client, claimIn('RESOLVED'), { status: 'CONFIRMED', severity: 'CRITICAL' }, NOW))).toBe('403');
    expect(summarize(decideIssueChange(actors.client, claimIn('RESOLVED'), { severity: 'CRITICAL' }, NOW))).toBe('403');
  });

  it('an admin can set it together with an assignment', () => {
    const decision = decideIssueChange(actors.admin, claimIn('PENDING_AGENT'), { status: 'IN_PROGRESS', agentId: OTHER_AGENT_ID, severity: 'CRITICAL' }, NOW);
    expect(decision).toMatchObject({ outcome: 'apply', transition: 'assign', data: { severity: 'CRITICAL' } });
  });
});

describe('assigning agents', () => {
  it('only an admin can name an agent', () => {
    expect(summarize(decideIssueChange(actors.agent, claimIn('PENDING_AGENT'), { status: 'IN_PROGRESS', severity: 'LOW', agentId: OTHER_AGENT_ID }, NOW))).toBe('403');
    expect(summarize(decideIssueChange(actors.client, claimIn('RESOLVED'), { status: 'IN_PROGRESS', agentId: OTHER_AGENT_ID }, NOW))).toBe('403');
  });
});

describe('access', () => {
  it('a resident only reaches their own claims', () => {
    expect(canAccessIssue(actors.client, claimIn('RESOLVED'))).toBe(true);
    expect(canAccessIssue(actors.client, claimIn('RESOLVED', { clientId: 99 }))).toBe(false);
  });

  it('an agent reaches claims they hold, and unassigned pending ones', () => {
    expect(canAccessIssue(actors.agent, claimIn('IN_PROGRESS'))).toBe(true);
    expect(canAccessIssue(actors.agent, claimIn('PENDING_AGENT'))).toBe(true);
    expect(canAccessIssue(actors.agent, claimIn('IN_PROGRESS', { agentId: OTHER_AGENT_ID }))).toBe(false);
    expect(canAccessIssue(actors.agent, claimIn('REJECTED'))).toBe(false);
  });

  it('refuses a stranger before looking at the request', () => {
    const decision = decideIssueChange(actors.client, claimIn('RESOLVED', { clientId: 99 }), { status: 'CONFIRMED' }, NOW);
    expect(summarize(decision)).toBe('403');
  });
});

describe('available transitions', () => {
  const cases: [WorkflowRole, IssueSnapshot, string[]][] = [
    ['agent', claimIn('PENDING_AGENT'), ['claim', 'reject']],
    ['agent', claimIn('IN_PROGRESS'), ['resolve']],
    ['agent', claimIn('IN_PROGRESS', { agentId: OTHER_AGENT_ID }), []],
    ['client', claimIn('RESOLVED'), ['confirm', 'dispute']],
    ['client', claimIn('IN_PROGRESS'), []],
    ['client', claimIn('RESOLVED', { clientId: 99 }), []],
    ['admin', claimIn('PENDING_AGENT'), ['assign', 'reject']],
    ['admin', claimIn('REJECTED'), ['overrideRejection']],
    ['admin', claimIn('DISPUTED'), ['reopenDispute']],
    ['admin', claimIn('CONFIRMED'), []],
    ['admin', claimIn('RESOLVED'), []],
  ];

  for (const [role, issue, names] of cases) {
    it(`${role} on a ${issue.status} claim (agent ${issue.agentId}, client ${issue.clientId}): ${names.join(', ') || 'nothing'}`, () => {
      expect(availableTransitions(actors[role], issue, NOW).sort()).toEqual([...names].sort());
    });
  }
});

describe('parsing the request', () => {
  const parse = (body: unknown) => parseIssueChange(body);

  it('accepts each field the screens send', () => {
    expect(parse({ status: 'DISPUTED', disputeReason: 'x' })).toEqual({ ok: true, change: { status: 'DISPUTED', disputeReason: 'x' } });
    expect(parse({ agentId: 4, status: 'IN_PROGRESS' })).toEqual({ ok: true, change: { agentId: 4, status: 'IN_PROGRESS' } });
    expect(parse({ severity: 'LOW' })).toEqual({ ok: true, change: { severity: 'LOW' } });
  });

  it.each([
    ['not an object', 'CONFIRMED'],
    ['null', null],
    ['an array', [{ status: 'CONFIRMED' }]],
    ['empty', {}],
    ['an unknown status', { status: 'CLOSED' }],
    ['a lowercase status', { status: 'confirmed' }],
    ['a null status', { status: null }],
    ['an unknown priority', { severity: 'URGENT' }],
    ['an empty priority', { severity: '' }],
    ['an agent id as text', { status: 'IN_PROGRESS', agentId: '4' }],
    ['a fractional agent id', { status: 'IN_PROGRESS', agentId: 4.5 }],
    ['a zero agent id', { status: 'IN_PROGRESS', agentId: 0 }],
    ['a negative agent id', { status: 'IN_PROGRESS', agentId: -2 }],
    ['an agent without moving to in progress', { agentId: 4 }],
    ['a rejection reason on a confirmation', { status: 'CONFIRMED', rejectionReason: 'x' }],
    ['a dispute reason on a rejection', { status: 'REJECTED', disputeReason: 'x' }],
    ['a reason that is not text', { status: 'REJECTED', rejectionReason: 42 }],
    ['a field the server does not accept', { status: 'CONFIRMED', closedAt: '2020-01-01' }],
    ['a deadline', { deadlineAt: '2030-01-01' }],
    ['an AI description', { aiDescription: 'x' }],
    ['a client id', { status: 'CONFIRMED', clientId: 1 }],
  ])('refuses %s', (_label, body) => {
    expect(parse(body).ok).toBe(false);
  });

  it('names the fields it will not accept', () => {
    const result = parse({ status: 'CONFIRMED', closedAt: 'x', resolvedAt: 'y' });
    expect(result).toEqual({ ok: false, message: expect.stringContaining('closedAt, resolvedAt') });
  });

  it('trims reasons', () => {
    expect(parse({ status: 'REJECTED', rejectionReason: '  Doublon  ' })).toEqual({ ok: true, change: { status: 'REJECTED', rejectionReason: 'Doublon' } });
  });

  it('treats a blank reason as missing, so the rule can ask for one', () => {
    expect(parse({ status: 'REJECTED', rejectionReason: '   ' })).toEqual({ ok: true, change: { status: 'REJECTED' } });
  });

  it('accepts a reason at the limit and refuses one over it', () => {
    expect(parse({ status: 'REJECTED', rejectionReason: 'a'.repeat(MAX_REASON_LENGTH) }).ok).toBe(true);
    expect(parse({ status: 'REJECTED', rejectionReason: 'a'.repeat(MAX_REASON_LENGTH + 1) }).ok).toBe(false);
  });
});

describe('scheduling visits', () => {
  it.each(ISSUE_STATUSES.map(s => [s]))('assigned agent, %s claim', (status) => {
    const result = decideVisitScheduling(actors.agent, claimIn(status as IssueStatusValue, { agentId: AGENT_ID }));
    if (status === 'IN_PROGRESS') {
      expect(result).toEqual({ ok: true });
    } else {
      expect(result).toMatchObject({ ok: false, httpStatus: 409 });
    }
  });

  it('refuses an agent who is not assigned', () => {
    expect(decideVisitScheduling(actors.agent, claimIn('IN_PROGRESS', { agentId: OTHER_AGENT_ID }))).toMatchObject({ ok: false, httpStatus: 403 });
  });

  it('refuses admins and residents', () => {
    expect(decideVisitScheduling(actors.admin, claimIn('IN_PROGRESS'))).toMatchObject({ ok: false, httpStatus: 403 });
    expect(decideVisitScheduling(actors.client, claimIn('IN_PROGRESS'))).toMatchObject({ ok: false, httpStatus: 403 });
  });
});

describe('posting messages', () => {
  it.each(ISSUE_STATUSES.map(s => [s]))('resident on a %s claim', (status) => {
    const closed = status === 'CONFIRMED' || status === 'REJECTED';
    expect(decideMessagePosting('client', status as IssueStatusValue)).toEqual(
      closed ? expect.objectContaining({ ok: false, httpStatus: 409 }) : { ok: true }
    );
  });

  it('an admin can always write, including on closed claims', () => {
    for (const status of ISSUE_STATUSES) {
      expect(decideMessagePosting('admin', status)).toEqual({ ok: true });
    }
  });

  it('an agent never takes part in the conversation', () => {
    for (const status of ISSUE_STATUSES) {
      expect(decideMessagePosting('agent', status)).toMatchObject({ ok: false, httpStatus: 403 });
    }
  });
});
