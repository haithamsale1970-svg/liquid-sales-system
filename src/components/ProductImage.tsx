"use client";

import { useState } from "react";
import { cls, initials } from "@/lib/shared";

const GRADS = [
  "linear-gradient(135deg,#0f4f43,#2de6b8)",
  "linear-gradient(135deg,#34307c,#8b7cff)",
  "linear-gradient(135deg,#5c380c,#ffc24b)",
  "linear-gradient(135deg,#571032,#ff6b81)",
  "linear-gradient(135deg,#0d3550,#56b6f7)",
];

function pick(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return GRADS[h % GRADS.length];
}

export function ProductImage({
  src,
  name,
  size = 44,
  radius = 12,
  className,
}: {
  src?: string;
  name: string;
  size?: number;
  radius?: number;
  className?: string;
}) {
  const [err, setErr] = useState(false);
  if (src && !err) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={name}
        onError={() => setErr(true)}
        className={cls("shrink-0 object-cover", className)}
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          border: "1px solid var(--line-soft)",
          background: "#0b0f13",
        }}
      />
    );
  }
  return (
    <div
      className={cls(
        "flex shrink-0 items-center justify-center font-extrabold text-white/90",
        className,
      )}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: pick(name),
        fontSize: Math.max(11, size * 0.32),
        border: "1px solid var(--line-soft)",
      }}
    >
      {initials(name)}
    </div>
  );
}
