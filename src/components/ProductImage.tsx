"use client";

import { useState } from "react";
import { Maximize2, RotateCcw, X, ZoomIn, ZoomOut } from "lucide-react";
import { cls, initials } from "@/lib/shared";

/** معاينة صورة المنتج مع تكبير/تصغير وإعادة ضبط وإغلاق سلس. */
export default function ImageZoom({
  src,
  name,
  className,
  imageClassName,
  size,
  radius,
}: {
  src?: string;
  name: string;
  className?: string;
  imageClassName?: string;
  size?: number;
  radius?: number;
}) {
  const [open, setOpen] = useState(false);
  const [scale, setScale] = useState(1);

  function show() {
    setScale(1);
    setOpen(true);
  }

  return (
    <>
      <span
        role="button"
        tabIndex={0}
        aria-label={`تكبير صورة ${name}`}
        className={cls("group relative inline-flex cursor-zoom-in", className)}
        onClick={(event) => {
          event.stopPropagation();
          show();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            show();
          }
        }}
      >
        <ProductImage
          src={src}
          name={name}
          className={imageClassName}
          size={size}
          radius={radius}
        />
        {src && (
          <span className="pointer-events-none absolute bottom-1 end-1 flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-black/65 text-white opacity-0 transition-opacity group-hover:opacity-100">
            <Maximize2 size={12} />
          </span>
        )}
      </span>
      {open && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`معاينة صورة ${name}`}
          onClick={() => setOpen(false)}
        >
          <div
            className="relative flex max-h-full max-w-5xl flex-col items-center gap-3"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-2 rounded-2xl border border-white/15 bg-black/70 p-2 text-white">
              <button
                className="icon-btn"
                type="button"
                title="تصغير"
                onClick={() => setScale((v) => Math.max(0.5, Number((v - 0.25).toFixed(2))))}
              >
                <ZoomOut size={17} />
              </button>
              <span className="num min-w-14 text-center text-xs font-bold">
                {Math.round(scale * 100)}%
              </span>
              <button
                className="icon-btn"
                type="button"
                title="تكبير"
                onClick={() => setScale((v) => Math.min(3, Number((v + 0.25).toFixed(2))))}
              >
                <ZoomIn size={17} />
              </button>
              <button
                className="icon-btn"
                type="button"
                title="إعادة الضبط"
                onClick={() => setScale(1)}
              >
                <RotateCcw size={16} />
              </button>
              <button
                className="icon-btn"
                type="button"
                title="إغلاق"
                onClick={() => setOpen(false)}
              >
                <X size={17} />
              </button>
            </div>
            <div className="max-h-[78vh] overflow-auto rounded-2xl border border-white/15 bg-[#0b0b0b] p-3">
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={src}
                  alt={name}
                  className="block max-h-[72vh] max-w-[90vw] object-contain transition-transform duration-200"
                  style={{ transform: `scale(${scale})` }}
                />
              ) : (
                <ProductImage src="" name={name} size={280} radius={20} />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}


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
