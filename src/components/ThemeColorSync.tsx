'use client';

import { useEffect } from 'react';
import { useTheme } from 'next-themes';

// The browser paints its own bars with the theme-color meta tag. The server
// sets it from the role, so this keeps it right after someone switches theme.
export function ThemeColorSync({ colors }: { colors: { light: string; dark: string } }) {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const color = resolvedTheme === 'dark' ? colors.dark : colors.light;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = color;
  }, [resolvedTheme, colors.dark, colors.light]);

  return null;
}
