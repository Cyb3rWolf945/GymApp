'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

/** One bar series per day or step. Client component: Recharts needs the browser. Gets plain, already-aggregated data. */
export function BarSeries({ data, xKey, yKey, label }: { data: Record<string, string | number>[]; xKey: string; yKey: string; label: string }) {
  return (
    <div role="img" aria-label={label} className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid stroke="#262626" vertical={false} />
          <XAxis dataKey={xKey} stroke="#737373" fontSize={12} />
          <YAxis stroke="#737373" fontSize={12} />
          <Tooltip contentStyle={{ background: '#171717', border: '1px solid #404040' }} />
          <Bar dataKey={yKey} fill="#10b981" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
