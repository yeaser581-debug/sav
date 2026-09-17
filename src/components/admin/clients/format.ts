export function clientLabel(client: { name: string | null; login: string }): string {
  return client.name?.trim() || client.login;
}

export function initials(label: string): string {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return (first + last).toUpperCase();
}

export function homeLabel(client: { unitNumber: string | null; building: { name: string } | null }): string {
  return [client.building?.name, client.unitNumber && `Apt ${client.unitNumber}`].filter(Boolean).join(' · ') || '—';
}

export function formatDay(iso: string | null | undefined, withYear = true): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', ...(withYear && { year: 'numeric' }),
  });
}

// 18 h, 4,2 j
export function formatDuration(hours: number | null): string {
  if (hours === null) return '—';
  if (hours < 24) return `${Math.max(1, Math.round(hours))} h`;
  return `${(hours / 24).toFixed(1).replace('.', ',')} j`;
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

// The link a resident scans to sign in once.
export function qrLoginUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
  return `${base}/api/auth/qr?token=${token}`;
}
