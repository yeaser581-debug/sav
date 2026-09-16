import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

// Reads the real tokens from globals.css and checks them, so a hand-edited
// colour cannot quietly become unreadable or start looking like another status.

const css = readFileSync(path.join(process.cwd(), 'src/app/globals.css'), 'utf8');

function tokensOf(selector: string): Record<string, string> {
  const block = css.match(new RegExp(`${selector}\\s*\\{([^}]*)\\}`));
  if (!block) throw new Error(`No ${selector} block in globals.css`);
  const tokens: Record<string, string> = {};
  for (const [, name, value] of block[1].matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    tokens[name] = value.toLowerCase();
  }
  return tokens;
}

const themes = { light: tokensOf(':root'), dark: tokensOf('\\.dark') };

const channels = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// sRGB → OKLab, so "do these two colours look alike" is measured the way the
// eye sees it rather than by raw channel differences.
function oklab(hex: string): [number, number, number] {
  const [r, g, b] = channels(hex).map(toLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function perceptualDistance(a: string, b: string): number {
  const x = oklab(a);
  const y = oklab(b);
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

const TEXT_PAIRS: [string, string][] = [
  ['foreground', 'background'],
  ['foreground', 'card'],
  ['foreground', 'muted'],
  ['foreground', 'accent'],
  ['muted-foreground', 'background'],
  ['muted-foreground', 'card'],
  ['muted-foreground', 'muted'],
  ['primary-foreground', 'primary'],
  ['primary', 'card'],
  ['primary', 'muted'],
  ['accent-foreground', 'accent'],
  ['neutral', 'neutral-wash'],
  ['neutral', 'card'],
  ['neutral', 'muted'],
  ['warning', 'warning-wash'],
  ['warning', 'card'],
  ['warning', 'muted'],
  ['success', 'success-wash'],
  ['success', 'card'],
  ['success', 'muted'],
  ['destructive', 'destructive-wash'],
  ['destructive', 'card'],
  ['destructive', 'background'],
  ['destructive', 'muted'],
];

// Boundaries and shapes only have to reach 3:1 to be identifiable.
const UI_PAIRS: [string, string][] = [
  ['input', 'background'],
  ['input', 'card'],
  ['primary', 'background'],
];

// Colours a user must never confuse: the brand, and the four status families.
const MUST_DIFFER: [string, string][] = [
  ['primary', 'destructive'],
  ['primary', 'warning'],
  ['primary', 'success'],
  ['warning', 'destructive'],
  ['warning', 'success'],
  ['success', 'neutral'],
  ['neutral', 'warning'],
];

describe.each(Object.entries(themes))('%s theme', (_name, t) => {
  it('defines every token the interface uses', () => {
    const required = new Set([...TEXT_PAIRS, ...UI_PAIRS, ...MUST_DIFFER].flat());
    for (const token of required) expect(t, `missing --${token}`).toHaveProperty(token);
  });

  it.each(TEXT_PAIRS)('%s on %s is readable (AA 4.5:1)', (fg, bg) => {
    expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(UI_PAIRS)('%s against %s is visible (3:1)', (fg, bg) => {
    expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(3);
  });

  it.each(MUST_DIFFER)('%s does not look like %s', (a, b) => {
    expect(perceptualDistance(t[a], t[b])).toBeGreaterThanOrEqual(0.1);
  });

  it('separates cards from the page background', () => {
    expect(perceptualDistance(t.background, t.card)).toBeGreaterThanOrEqual(0.04);
  });

  it('keeps the brand colour out of the danger token', () => {
    expect(t.destructive).not.toBe(t.primary);
  });
});

describe('the two themes', () => {
  it('keeps the dark theme off pure black, so long sessions stay comfortable', () => {
    expect(luminance(themes.dark.background)).toBeGreaterThan(0.015);
  });

  it('flips the brand with the ground', () => {
    expect(luminance(themes.light.primary)).toBeLessThan(luminance(themes.light.background));
    expect(luminance(themes.dark.primary)).toBeGreaterThan(luminance(themes.dark.background));
  });

  it('keeps hover and selection visible against the page', () => {
    for (const t of Object.values(themes)) {
      expect(perceptualDistance(t.background, t.muted)).toBeGreaterThanOrEqual(0.02);
    }
  });

  it('defines the same set of tokens', () => {
    expect(Object.keys(themes.dark).sort()).toEqual(
      Object.keys(themes.light).filter(k => k !== 'radius').sort()
    );
  });
});
