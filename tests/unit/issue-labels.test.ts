import { describe, it, expect } from 'vitest';
import { issueSubject, type IssueTableItem } from '@/components/issues/IssueTable';
import { severityLabel, SEVERITY_OPTIONS } from '@/components/ui/severity-badge';
import { statusLabel } from '@/components/ui/status-badge';

const base: IssueTableItem = {
  id: 1,
  originalDescription: 'Fuite dans la salle de bain',
  status: 'IN_PROGRESS',
  severity: 'CRITICAL',
};

describe('issueSubject', () => {
  it('uses the description when there is one', () => {
    expect(issueSubject(base)).toBe('Fuite dans la salle de bain');
  });

  it('falls back to the latest message when the description is empty', () => {
    const issue = { ...base, originalDescription: '   ', latestMessage: { message: 'Ça coule encore', senderType: 'CLIENT', createdAt: '2026-01-01' } };
    expect(issueSubject(issue)).toBe('Ça coule encore');
  });

  it('marks an admin fallback message as ours', () => {
    const issue = { ...base, originalDescription: null, latestMessage: { message: 'Un agent passe demain', senderType: 'ADMIN', createdAt: '2026-01-01' } };
    expect(issueSubject(issue)).toBe('Vous : Un agent passe demain');
  });

  it('describes a media-only message', () => {
    const issue = { ...base, originalDescription: null, latestMessage: { message: '', mediaType: 'AUDIO', senderType: 'CLIENT', createdAt: '2026-01-01' } };
    expect(issueSubject(issue)).toBe('🎤 Message vocal');
  });

  it('names an unknown media type generically rather than showing nothing', () => {
    const issue = { ...base, originalDescription: null, latestMessage: { message: '', mediaType: 'HOLOGRAM', senderType: 'CLIENT', createdAt: '2026-01-01' } };
    expect(issueSubject(issue)).toBe('Pièce jointe');
  });

  it('degrades to a placeholder when there is nothing at all', () => {
    expect(issueSubject({ ...base, originalDescription: null })).toBe('Sans description');
  });

  it('prefers the description over the latest message', () => {
    const issue = { ...base, latestMessage: { message: 'plus récent', senderType: 'CLIENT', createdAt: '2026-01-01' } };
    expect(issueSubject(issue)).toBe('Fuite dans la salle de bain');
  });
});

describe('severity vocabulary', () => {
  it('calls CRITICAL "Urgent", never "Critique"', () => {
    expect(severityLabel('CRITICAL')).toBe('Urgent');
  });

  it('labels the other two levels', () => {
    expect(severityLabel('MEDIUM')).toBe('Moyen');
    expect(severityLabel('LOW')).toBe('Faible');
  });

  it('handles an absent severity', () => {
    expect(severityLabel(null)).toBe('Non défini');
    expect(severityLabel(undefined)).toBe('Non défini');
  });

  it('offers exactly the three values the enum has', () => {
    expect(SEVERITY_OPTIONS.map(o => o.value)).toEqual(['CRITICAL', 'MEDIUM', 'LOW']);
  });

  it('keeps the dropdown and the badge on the same wording', () => {
    for (const option of SEVERITY_OPTIONS) {
      expect(option.label).toBe(severityLabel(option.value));
    }
  });
});

describe('status vocabulary', () => {
  it('labels every status the enum defines', () => {
    expect(statusLabel('PENDING_AGENT')).toBe('Nouvelle');
    expect(statusLabel('IN_PROGRESS')).toBe('En cours');
    expect(statusLabel('RESOLVED')).toBe('Résolue');
    expect(statusLabel('CONFIRMED')).toBe('Confirmée');
    expect(statusLabel('DISPUTED')).toBe('Contestée');
    expect(statusLabel('REJECTED')).toBe('Rejetée');
  });

  it('gives every status a distinct label', () => {
    const statuses = ['PENDING_AGENT', 'IN_PROGRESS', 'RESOLVED', 'CONFIRMED', 'DISPUTED', 'REJECTED'];
    const labels = statuses.map(statusLabel);
    expect(new Set(labels).size).toBe(statuses.length);
  });

  it('passes an unknown status through rather than crashing', () => {
    expect(statusLabel('SOMETHING_ELSE')).toBe('SOMETHING_ELSE');
  });
});
