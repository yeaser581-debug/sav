// Who is trying to sign in, judged from what they typed. Pure, so the rule is
// testable on its own: staff use an email address, residents use the unit code
// printed on their fiche (gz-t1-3-a-a-21).

export type IdentifierKind = 'email' | 'unit';

export const SIGN_IN_ERROR = 'Identifiant ou mot de passe incorrect.';

/** Trimmed and lowercased: unit codes and emails are both case-insensitive. */
export function normalizeIdentifier(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
}

export function identifierKind(identifier: string): IdentifierKind {
  return identifier.includes('@') ? 'email' : 'unit';
}
