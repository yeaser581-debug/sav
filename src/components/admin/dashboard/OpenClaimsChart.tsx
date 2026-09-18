'use client';

import Link from 'next/link';
import { Cell, Label, Pie, PieChart } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { statusLabel } from '@/components/ui/status-badge';

// Open claims only: a ring where three quarters is "resolved" says nothing.
// These are status colours, so they keep the tokens the badges use.
const TONE: Record<string, string> = {
  PENDING_AGENT: 'var(--neutral)',
  IN_PROGRESS: 'var(--warning)',
  DISPUTED: 'var(--destructive)',
};

export function OpenClaimsChart({ rows, total }: {
  rows: { status: string; count: number }[];
  total: number;
}) {
  const config: ChartConfig = Object.fromEntries(
    rows.map(r => [r.status, { label: statusLabel(r.status), color: TONE[r.status] }]),
  );
  const data = rows.map(r => ({ status: r.status, count: r.count, fill: TONE[r.status] }));

  return (
    <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
      <ChartContainer config={config} className="aspect-square h-40 w-40 shrink-0 sm:h-44 sm:w-44">
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent nameKey="status" hideLabel />} />
          <Pie data={data} dataKey="count" nameKey="status" innerRadius="62%" outerRadius="100%" paddingAngle={2} strokeWidth={0}>
            {data.map(entry => <Cell key={entry.status} fill={entry.fill} />)}
            <Label
              content={({ viewBox }) => {
                if (!viewBox || !('cx' in viewBox)) return null;
                return (
                  <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                    <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-2xl font-bold">{total}</tspan>
                    <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) + 18} className="fill-muted-foreground text-[11px]">
                      {total > 1 ? 'ouvertes' : 'ouverte'}
                    </tspan>
                  </text>
                );
              }}
            />
          </Pie>
        </PieChart>
      </ChartContainer>

      <ul className="flex min-w-0 flex-1 flex-col justify-center gap-2.5">
        {rows.map(row => (
          <li key={row.status}>
            <Link
              href={`/admin/issues?status=${row.status}`}
              className="grid grid-cols-[10px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-md py-1 text-xs hover:text-foreground"
            >
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: TONE[row.status] }} aria-hidden />
              <span className="truncate">{statusLabel(row.status)}</span>
              <span className="font-semibold tabular-nums">{row.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
