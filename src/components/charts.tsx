"use client";

import { fmtNum } from "@/lib/shared";

export function BarsChart({
  data,
  height = 190,
  format = fmtNum,
  hue = "mint",
}: {
  data: Array<{ label: string; value: number; sub?: string }>;
  height?: number;
  format?: (n: number) => string;
  hue?: "mint" | "violet";
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="overflow-x-auto pb-1">
      <div
        className="flex items-end gap-[7px] pt-6"
        style={{
          height,
          minWidth: data.length > 16 ? data.length * 30 : undefined,
        }}
      >
        {data.map((d, i) => (
          <div key={i} className="bar-col" style={{ height: "100%" }}>
            <div className="tip">
              <span className="num">{format(d.value)}</span>
              {d.sub && (
                <span className="block font-bold text-[var(--faint)]">
                  {d.sub}
                </span>
              )}
            </div>
            <div
              className="bar"
              style={{
                height: `${Math.max(1.6, (d.value / max) * 100)}%`,
                background:
                  hue === "violet"
                    ? "linear-gradient(180deg, rgba(255,255,255,.85), rgba(255,255,255,.25))"
                    : undefined,
              }}
            />
            <span
              className="num max-w-full truncate text-[9.5px] font-bold text-[var(--faint)]"
            >
              {d.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Sparkline({
  points,
  color = "#ff2222",
  w = 100,
  h = 32,
}: {
  points: number[];
  color?: string;
  w?: number;
  h?: number;
}) {
  if (points.length < 2) return null;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const p = points
    .map(
      (v, i) =>
        `${((i * w) / (points.length - 1)).toFixed(1)},${(
          h -
          3 -
          ((v - min) / range) * (h - 6)
        ).toFixed(1)}`,
    )
    .join(" ");
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="overflow-visible opacity-90"
    >
      <polyline
        points={p}
        fill="none"
        stroke={color}
        strokeWidth={2.4}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
