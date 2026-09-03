import { describe, it, expect } from 'vitest';
import { conversationSnippet, unitInitials, type IssueTableItem } from '@/components/issues/IssueTable';

const base: IssueTableItem = {
  id: 1,
  originalDescription: 'Fuite dans la salle de bain',
  status: 'PENDING_AGENT',
  severity: 'CRITICAL',
};

describe('conversationSnippet', () => {
  it('falls back to the original description when there is no message yet', () => {
    expect(conversationSnippet(base)).toBe('Fuite dans la salle de bain');
  });

  it('falls back to a generic label when there is no description either', () => {
    expect(conversationSnippet({ ...base, originalDescription: null })).toBe('Sans description');
  });

  it('shows the latest message text from the client with no prefix', () => {
    const issue = { ...base, latestMessage: { message: 'Ca continue de couler', senderType: 'CLIENT', createdAt: new Date() } };
    expect(conversationSnippet(issue)).toBe('Ca continue de couler');
  });

  it('prefixes with "Vous :" when the latest message is from the admin', () => {
    const issue = { ...base, latestMessage: { message: 'On envoie un agent demain', senderType: 'ADMIN', createdAt: new Date() } };
    expect(conversationSnippet(issue)).toBe('Vous : On envoie un agent demain');
  });

  it('falls back to a media-type emoji when the latest message has no text', () => {
    const issue = { ...base, latestMessage: { message: '', mediaType: 'PHOTO', senderType: 'CLIENT', createdAt: new Date() } };
    expect(conversationSnippet(issue)).toBe('📷 Photo');
  });

  it('falls back to the description if a text-less, media-less message somehow arrives', () => {
    const issue = { ...base, latestMessage: { message: '', senderType: 'CLIENT', createdAt: new Date() } };
    expect(conversationSnippet(issue)).toBe('Fuite dans la salle de bain');
  });
});

describe('unitInitials', () => {
  it('uppercases and caps at two characters', () => {
    expect(unitInitials('a102')).toBe('A1');
  });

  it('falls back to "?" when there is no unit number', () => {
    expect(unitInitials(null)).toBe('?');
    expect(unitInitials(undefined)).toBe('?');
    expect(unitInitials('')).toBe('?');
  });
});
