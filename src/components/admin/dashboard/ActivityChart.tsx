'use client';

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';

// Two series only. The colours were checked for colour-blindness and contrast
// against the card, in both themes.
const config = {
  created: { label: 'Créées', color: 'var(--chart-created)' },
  resolved: { label: 'Résolues', color: 'var(--chart-resolved)' },
} satisfies ChartConfig;

export function ActivityChart({ weeks }: { weeks: { label: string; created: number; resolved: number }[] }) {
  return (
    <ChartContainer config={config} className="aspect-auto h-44 w-full">
      <AreaChart data={weeks} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
        <defs>
          {(['created', 'resolved'] as const).map(key => (
            <linearGradient key={key} id={`fill-${key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={`var(--color-${key})`} stopOpacity={0.3} />
              <stop offset="95%" stopColor={`var(--color-${key})`} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis width={28} tickLine={false} axisLine={false} allowDecimals={false} tickMargin={4} />
        <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
        <Area
          dataKey="created"
          type="monotone"
          stroke="var(--color-created)"
          strokeWidth={2}
          fill="url(#fill-created)"
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Area
          dataKey="resolved"
          type="monotone"
          stroke="var(--color-resolved)"
          strokeWidth={2}
          fill="url(#fill-resolved)"
          dot={false}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ChartContainer>
  );
}
