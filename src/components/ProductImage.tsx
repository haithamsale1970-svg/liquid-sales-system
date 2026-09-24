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
