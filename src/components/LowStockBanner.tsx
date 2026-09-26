"use client";

// تنبيه انخفاض المخزون على الشاشة — شريط يظهر في كل الصفحات (AppShell)
// مع إمكانية الفتح لعرض الأصناف، والانتقال لصفحة الأصناف لتعبئة الكميات.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BellRing, ChevronDown, RefreshCw, X } from "lucide-react";
import { api } from "@/lib/client";
import { cls, fmtNum, type LowStockAlertDTO } from "@/lib/shared";
import { ProductImage } from "@/components/ProductImage";

type Payload = { count: number; outOfStock: number; items: LowStockAlertDTO[] };

const HIDE_KEY = "cc_lowstock_hidden";

export default function LowStockBanner() {
  const [data, setData] = useState<Payload | null>(null);
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api<Payload>("/api/products/alerts?limit=8"));
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      setHidden(window.sessionStorage.getItem(HIDE_KEY) === "1");
    } catch {}
    load();
    const t = window.setInterval(load, 60_000);
    return () => window.clearInterval(t);
  }, [load]);

  const count = data?.count ?? 0;
  if (hidden || count === 0) return null;

  const outCount = data?.outOfStock ?? 0;

  return (
    <div
      className={cls(
        "no-print anim-in mb-4 overflow-hidden rounded-2xl border",
        outCount > 0
          ? "border-[rgba(255,43,43,.45)] bg-[rgba(255,43,43,.08)]"
          : "border-[rgba(255,170,0,.35)] bg-[rgba(255,170,0,.07)]",
      )}
    >
      <div className="flex flex-wrap items-center gap-2.5 px-3.5 py-2.5">
        <span
          className={cls(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
            outCount > 0
              ? "bg-[var(--accent-soft-2)] text-[var(--danger)]"
              : "bg-[var(--alert-soft)] text-[var(--alert-text)]",
          )}
        >
          <BellRing size={16} />
        </span>
        <div className="min-w-0 flex-1 text-[12.5px] font-extrabold leading-6">
          تنبيه نقص المخزون:{" "}
          <span className="num">{fmtNum(count)}</span> صنف وصل إلى حد التنبيه أو أقل
          {outCount > 0 && (
            <span className="text-[var(--danger)]">
              {" "}
              — منها <span className="num">{fmtNum(outCount)}</span> نفدت بالكامل
            </span>
          )}
        </div>
        <button
          className="btn btn-ghost btn-xs"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <ChevronDown
            size={13}
            className={cls("transition-transform", open && "rotate-180")}
          />
          {open ? "إخفاء القائمة" : "عرض الأصناف"}
        </button>
        <Link href="/products" className="btn btn-primary btn-xs">
          إدارة المخزون
        </Link>
        <button
          className="icon-btn !h-7 !w-7"
          title="تحديث التنبيه"
          onClick={load}
          disabled={loading}
        >
          <RefreshCw size={13} className={cls(loading && "animate-spin")} />
        </button>
        <button
          className="icon-btn !h-7 !w-7"
          title="إخفاء حتى تسجيل الدخول القادم"
          onClick={() => {
            setHidden(true);
            try {
              window.sessionStorage.setItem(HIDE_KEY, "1");
            } catch {}
          }}
        >
          <X size={13} />
        </button>
      </div>

      {open && (
        <ul className="grid grid-cols-1 gap-1.5 border-t border-[var(--line-soft)] p-2.5 sm:grid-cols-2">
          {(data?.items ?? []).map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-2.5 rounded-xl border border-[var(--line-soft)] bg-[var(--overlay-1)] px-2.5 py-2"
            >
              <ProductImage src={p.imageUrl} name={p.name} size={32} radius={9} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-extrabold">{p.name}</div>
                <div className="text-[10.5px] font-bold text-[var(--faint)]">
                  حد التنبيه: <span className="num">{p.lowStockAt}</span>
                </div>
              </div>
              <span
                className={cls(
                  "num shrink-0 rounded-lg px-2 py-1 text-[11.5px] font-black",
                  p.stock <= 0
                    ? "bg-[var(--accent-soft)] text-[var(--danger)]"
                    : "bg-[var(--alert-soft)] text-[var(--alert-text)]",
                )}
              >
                {p.stock <= 0 ? "نفد" : `متبقٍ ${p.stock}`}
              </span>
            </li>
          ))}
          {count > (data?.items.length ?? 0) && (
            <li className="col-span-full text-center text-[11.5px] font-bold text-[var(--faint)]">
              و{fmtNum(count - (data?.items.length ?? 0))} صنف آخر —{" "}
              <Link href="/products" className="link">
                عرض الكل
              </Link>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
