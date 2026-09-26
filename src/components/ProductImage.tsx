"use client";

import { useState } from "react";
import { cls, initials } from "@/lib/shared";

const GRADS = [
  "linear-gradient(135deg,#1a0000,#ff2222)",
  "linear-gradient(135deg,#2b2b2b,#000000)",
  "linear-gradient(135deg,#4d0000,#ff4d4d)",
  "linear-gradient(135deg,#0a0a0a,#8f0000)",
  "linear-gradient(135deg,#330000,#d6d6d6)",
];

function pick(name: string) {
  let h = 0;
  for (const c of name) h = (c.charCodeAt(0) + h * 31) >>> 0;
  return GRADS[h % GRADS.length];
}

export function ProductImage({
  src,
  name,
  size = 44,
  radius = 12,
  fill = false,
  contain = false,
  className,
}: {
  src?: string;
  name: string;
  size?: number;
  radius?: number;
  fill?: boolean;
  contain?: boolean;
  className?: string;
}) {
  const [err, setErr] = useState(false);
  const box = fill
    ? undefined
    : {
        width: size,
        height: size,
        borderRadius: radius,
      };
  if (src && !err) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setErr(true)}
        className={cls(
          fill ? "h-full w-full" : "shrink-0",
          contain ? "object-contain" : "object-cover",
          className,
        )}
        style={{
          ...box,
          border: fill ? undefined : "1px solid var(--line-soft)",
          background: "#0b0f13",
          borderRadius: fill ? undefined : radius,
        }}
      />
    );
  }
  return (
    <div
      className={cls(
        "flex items-center justify-center font-extrabold text-[var(--text)]/90",
        fill ? "h-full w-full" : "shrink-0",
        className,
      )}
      style={{
        ...box,
        background: pick(name),
        fontSize: fill ? 28 : Math.max(11, size * 0.32),
        border: fill ? undefined : "1px solid var(--line-soft)",
        borderRadius: fill ? undefined : radius,
      }}
    >
      {initials(name)}
    </div>
  );
}
