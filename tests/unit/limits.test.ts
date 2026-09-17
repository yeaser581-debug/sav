import { describe, it, expect } from 'vitest';
import { LIMITS, checkLengths } from '@/lib/limits';

describe('checkLengths', () => {
  it('accepts values that fit', () => {
    expect(checkLengths([['Le nom', 'Lahcen El Faid', LIMITS.name]])).toBeNull();
  });

  it('accepts a value of exactly the limit', () => {
    expect(checkLengths([['Le nom', 'x'.repeat(LIMITS.name), LIMITS.name]])).toBeNull();
  });

  it('names the field and the limit when it is one character too long', () => {
    expect(checkLengths([['Le nom', 'x'.repeat(LIMITS.name + 1), LIMITS.name]]))
      .toBe(`Le nom ne peut pas dépasser ${LIMITS.name} caractères.`);
  });

  it('measures the trimmed value, so trailing spaces do not fail', () => {
    expect(checkLengths([['Le nom', `${'x'.repeat(LIMITS.name)}    `, LIMITS.name]])).toBeNull();
  });

  it('reports the first problem only', () => {
    const error = checkLengths([
      ['Le nom', 'ok', LIMITS.name],
      ['L’email', 'e'.repeat(LIMITS.email + 1), LIMITS.email],
      ['Le téléphone', 'p'.repeat(LIMITS.phone + 1), LIMITS.phone],
    ]);
    expect(error).toContain('L’email');
  });

  it('ignores values that are not text, leaving them to the route', () => {
    expect(checkLengths([
      ['Le nom', undefined, LIMITS.name],
      ['Le nom', null, LIMITS.name],
      ['L’immeuble', 42, LIMITS.name],
    ])).toBeNull();
  });

  it('keeps every limit inside what the database column holds', () => {
    const varchar191 = ['name', 'email', 'login', 'phone', 'unitNumber', 'address'] as const;
    for (const key of varchar191) {
      expect(LIMITS[key], key).toBeLessThanOrEqual(191);
    }
  });
});
