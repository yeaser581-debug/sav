import { describe, it, expect } from 'vitest';
import { clock, pseudoWaveform } from '@/components/ui/voice-note';

describe('clock', () => {
  it('formats seconds as m:ss', () => {
    expect(clock(0)).toBe('0:00');
    expect(clock(7)).toBe('0:07');
    expect(clock(65)).toBe('1:05');
    expect(clock(600)).toBe('10:00');
  });

  it('floors fractional seconds instead of rounding up past the end', () => {
    expect(clock(59.9)).toBe('0:59');
  });

  it('survives the NaN duration a browser reports before metadata loads', () => {
    expect(clock(NaN)).toBe('0:00');
  });

  it('survives the Infinity duration of a stream', () => {
    expect(clock(Infinity)).toBe('0:00');
  });

  it('does not render a negative time', () => {
    expect(clock(-5)).toBe('0:00');
  });
});

describe('pseudoWaveform', () => {
  it('draws a fixed number of bars', () => {
    expect(pseudoWaveform('/uploads/a.webm')).toHaveLength(32);
  });

  it('is stable for the same clip, so the shape does not jump between renders', () => {
    expect(pseudoWaveform('/uploads/a.webm')).toEqual(pseudoWaveform('/uploads/a.webm'));
  });

  it('differs between clips', () => {
    expect(pseudoWaveform('/uploads/a.webm')).not.toEqual(pseudoWaveform('/uploads/b.webm'));
  });

  it('keeps every bar visible and within the track', () => {
    for (const value of pseudoWaveform('/uploads/a.webm')) {
      expect(value).toBeGreaterThanOrEqual(0.25);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('handles an empty source without crashing', () => {
    expect(pseudoWaveform('')).toHaveLength(32);
  });

  it('is not a flat line', () => {
    const bars = pseudoWaveform('/uploads/a.webm');
    expect(new Set(bars).size).toBeGreaterThan(1);
  });
});
