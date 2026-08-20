"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";

/**
 * Booked value across the selected window, drawn small.
 *
 * A point is a day or a week depending on how long the window is — the caller
 * passes the grain so the tooltip can say which, rather than leaving the
 * reader to assume one and be wrong by a factor of seven.
 *
 * Recharts measures the DOM, so it is browser-only — the mount gate keeps SSR
 * and the first client render identical. Without it React hydration mismatches
 * and the chart flickers or throws. Same pattern as SkinProfileDashboard.tsx.
 */
export default function RevenueSpark({
  data,
  grain = "day",
}: {
  data: { date: string; value: number; count: number }[];
  grain?: "day" | "week";
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (!mounted) {
    return <div className="h-24 w-full animate-pulse rounded-xl bg-white/[0.06]" />;
  }

  // Nothing booked yet is a real answer, and a flat line at zero reads as a
  // broken chart rather than an empty diary.
  if (total === 0) {
    return (
      <div className="flex h-24 w-full items-end gap-1 rounded-xl px-1 pb-1">
        {/* A ghost of the chart that will be here, rather than an empty panel
            with a sentence in it. Nothing is claimed — every bar is flat. */}
        {Array.from({ length: 24 }, (_, i) => (
          <span
            key={i}
            className="flex-1 rounded-sm bg-white/[0.06]"
            style={{ height: `${8 + (i % 5) * 3}%` }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="h-24 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#28bda9" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#28bda9" stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={[0, "dataMax"]} />
          <Tooltip
            cursor={{ stroke: "rgba(255,255,255,0.25)" }}
            contentStyle={{
              background: "#0b1220",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 12,
              fontSize: 12,
              color: "#fff",
            }}
            labelStyle={{ color: "rgba(255,255,255,0.6)" }}
            labelFormatter={(_l, payload) => {
              const date = (payload?.[0]?.payload as { date?: string } | undefined)?.date;
              if (!date) return "";
              const pretty = new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                timeZone: "UTC",
              });
              return grain === "week" ? `Week of ${pretty}` : pretty;
            }}
            formatter={(value, _name, item) => {
              const v = typeof value === "number" ? value : 0;
              const count = (item?.payload as { count?: number } | undefined)?.count ?? 0;
              return [
                `₹${v.toLocaleString("en-IN")} · ${count} booking${count === 1 ? "" : "s"}`,
                "Booked",
              ];
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#28bda9"
            strokeWidth={2}
            fill="url(#sparkFill)"
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
