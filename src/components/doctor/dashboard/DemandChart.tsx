"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/**
 * What clients have actually been booking, over the last 90 days.
 *
 * Counted from the reason each patient chose at booking — so it is what they
 * came in for, not what the practice would like to be known for. "No reason
 * recorded" is charted alongside the rest rather than dropped, because
 * bookings that predate the intake form exist and hiding them would overstate
 * everything else.
 */
export default function DemandChart({
  data,
}: {
  data: { key: string; label: string; count: number }[];
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="h-64 w-full animate-pulse rounded-xl bg-slate-100" />;
  }

  const height = Math.max(data.length * 38, 120);

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="label"
            width={150}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#475569", fontSize: 12 }}
          />
          <Tooltip
            cursor={{ fill: "rgba(15,23,42,0.04)" }}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid rgb(226 232 240)",
              fontSize: 12,
            }}
            formatter={(value) => {
              const v = typeof value === "number" ? value : 0;
              return [`${v} booking${v === 1 ? "" : "s"}`, "In 90 days"];
            }}
          />
          <Bar dataKey="count" radius={[0, 6, 6, 0]} isAnimationActive={false}>
            {data.map((d) => (
              // The unrecorded bucket is deliberately grey — it is an absence
              // of data, not a category of demand.
              <Cell key={d.key} fill={d.key === "__none" ? "#cbd5e1" : "#1f6fd6"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
