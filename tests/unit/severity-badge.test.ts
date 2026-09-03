import { describe, it, expect } from 'vitest';
import { severityAccentColor } from '@/components/ui/severity-badge';

describe('severityAccentColor', () => {
  it('maps each known severity to a distinct color class', () => {
    expect(severityAccentColor('CRITICAL')).toBe('bg-destructive');
    expect(severityAccentColor('MEDIUM')).toBe('bg-warning');
    expect(severityAccentColor('LOW')).toBe('bg-muted-foreground');
  });

  it('falls back to the neutral color for null or an unknown value', () => {
    expect(severityAccentColor(null)).toBe('bg-muted-foreground');
    expect(severityAccentColor('SOMETHING_ELSE')).toBe('bg-muted-foreground');
  });
});
