"use client";

import { useState } from "react";
import { cls, initials } from "@/lib/shared";

// بدائل الصورة عند غيابها: ألوان مستمدة من الثيم (لا قيم ثابتة).
const GRADS = [
  "var(--img-fb-1)",
  "var(--img-fb-2)",
  "var(--img-fb-3)",
  "var(--img-fb-4)",
  "var(--img-fb-5)",
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
          // خلفية بيضاء نظيفة بدل الشريط الأسود في الثيم الفاتح
          background: "var(--img-bg)",
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
