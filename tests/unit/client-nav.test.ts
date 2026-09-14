import { describe, it, expect } from 'vitest';
import { activeNavIndex } from '@/components/client/ClientSidebar';

const nav = [
  { href: '/client', exact: true },
  { href: '/client/issues' },
  { href: '/client/issues/new' },
  { href: '/client/contract' },
];

describe('activeNavIndex', () => {
  it('matches the dashboard only exactly', () => {
    expect(activeNavIndex(nav, '/client')).toBe(0);
  });

  it('matches the issue list', () => {
    expect(activeNavIndex(nav, '/client/issues')).toBe(1);
  });

  it('keeps the issue list active on a detail page', () => {
    expect(activeNavIndex(nav, '/client/issues/42')).toBe(1);
  });

  it('prefers the longer prefix so /new wins over /issues', () => {
    expect(activeNavIndex(nav, '/client/issues/new')).toBe(2);
  });

  it('matches the contract page', () => {
    expect(activeNavIndex(nav, '/client/contract')).toBe(3);
  });

  it('returns -1 for a route outside the bar', () => {
    expect(activeNavIndex(nav, '/client/activate')).toBe(-1);
  });

  it('does not let the exact dashboard entry swallow its children', () => {
    expect(activeNavIndex(nav, '/client/contract')).not.toBe(0);
    expect(activeNavIndex(nav, '/client/issues')).not.toBe(0);
  });

  it('never reports more than one active entry', () => {
    for (const path of ['/client', '/client/issues', '/client/issues/7', '/client/issues/new', '/client/contract']) {
      const index = activeNavIndex(nav, path);
      const alsoActive = nav.filter((_, i) => i !== index && i === activeNavIndex(nav, path));
      expect(alsoActive).toHaveLength(0);
    }
  });
});
