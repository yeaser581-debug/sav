// How long each field may be, in one place, so the input and the route that
// receives it always agree.
//
// Most text columns are VARCHAR(191) in MySQL: without these checks an
// over-long value reaches the database and fails there with an error nobody
// can act on. The long ones (description, message, reason) are TEXT columns
// and are capped for readability, not by the column.

import { MAX_REASON_LENGTH } from '@/lib/issue-workflow';

export const LIMITS = {
  name: 120,
  email: 190,
  login: 60,
  password: 128,
  phone: 30,
  unitNumber: 20,
  address: 190,
  description: 5000,
  message: 2000,
  reason: MAX_REASON_LENGTH,
  note: 1000,
  contract: 50_000,
} as const;

export type LimitKey = keyof typeof LIMITS;

export type LengthCheck = [label: string, value: unknown, limit: number];

/**
 * The first field that is too long, phrased for the person who typed it, or
 * null when everything fits. Values that are not strings are left to the
 * route's own checks.
 */
export function checkLengths(fields: LengthCheck[]): string | null {
  for (const [label, value, limit] of fields) {
    if (typeof value === 'string' && value.trim().length > limit) {
      return `${label} ne peut pas dépasser ${limit} caractères.`;
    }
  }
  return null;
}
