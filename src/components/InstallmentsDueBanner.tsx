"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BellRing, ChevronDown, X } from "lucide-react";
import { api } from "@/lib/client";
import { cls, type InstallmentDTO } from "@/lib/shared";
import { useCurrency } from "@/components/useCurrency";
import { formatMoneyJOD } from "@/lib/currency";

/**
 * تنبيه الدفعات المستحقة: يظهر قبل موعد الدفعة بيوم وفي يوم الاستحقاق
 * (أصفر) وفي حال التأخير (برتقالي حرج).
 */
export default function InstallmentsDueBanner() {
  const { currency, rates } = useCurrency();
  const [items, setItems] = useState<InstallmentDTO[]>([]);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await api<InstallmentDTO[]>("/api/sales/0/installments"));
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    load();
    const t = window.setInterval(load, 5 * 60_000);
    return () => window.clearInterval(t);
  }, [load]);

  if (dismissed || items.length === 0) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysUntil = (d: string) =>
    Math.round(
      (new Date(d).setHours(0, 0, 0, 0) - today.getTime()) / 86_400_000,
    );

  const overdue = items.filter((i) => daysUntil(i.dueDate) < 0);
  const dueToday = items.filter((i) => daysUntil(i.dueDate) === 0);
  const soon = items.filter((i) => daysUntil(i.dueDate) === 1);

  const total = items.reduce((a, i) => a + i.amount, 0);
  const level = overdue.length > 0 ? "critical" : "warning";
  const headline =
    overdue.length > 0
      ? `تأخّر ${overdue.length} دفعة عن موعدها`
      : dueToday.length > 0
        ? `${dueToday.length} دفعة مستحقة اليوم`
        : `${soon.length} دفعة مستحقة غدًا`;

  return (
    <div
      className={cls(
        "no-print anim-in alert-banner mb-4 overflow-hidden",
        level === "critical" ? "alert-critical" : "alert-warning",
      )}
    >
      <div className="flex flex-wrap items-center gap-2.5 px-3.5 py-2.5">
        <span
          className={cls(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
            level === "critical" ? "alert-chip-critical" : "alert-chip-warning",
          )}
        >
          <BellRing size={16} />
        </span>
        <div className="min-w-0 flex-1 text-[12.5px] font-extrabold leading-6 text-[var(--text)]">
          تنبيه الذمم: <span className="num">{headline}</span> — بإجمالي{" "}
          <span className="num">{formatMoneyJOD(total, currency, rates)}</span>
        </div>
        <button
          className="btn btn-ghost btn-xs"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <ChevronDown size={13} className={cls("transition-transform", open && "rotate-180")} />
          {open ? "إخفاء" : "عرض الدفعات"}
        </button>
        <button
          className="icon-btn !h-7 !w-7"
          title="إخفاء التنبيه"
          onClick={() => setDismissed(true)}
        >
          <X size={13} />
        </button>
      </div>

      {open && (
        <ul className="grid grid-cols-1 gap-1.5 border-t border-[var(--line-soft)] p-2.5 sm:grid-cols-2">
          {items.map((i) => {
            const d = daysUntil(i.dueDate);
            const tag =
              d < 0 ? `متأخرة ${Math.abs(d)} يوم` : d === 0 ? "مستحقة اليوم" : d === 1 ? "غدًا" : `بعد ${d} يوم`;
            return (
              <li key={i.id}>
                <Link
                  href={`/sales/${i.saleId}`}
                  className="flex items-center justify-between gap-2 rounded-xl border border-[var(--line-soft)] bg-[var(--overlay-1)] px-2.5 py-2 transition-colors hover:border-[var(--accent-line)]"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[12px] font-extrabold">
                      {i.clientName || `فاتورة #${i.saleId}`}
                    </div>
                    <div className="num text-[10.5px] font-bold text-[var(--faint)]">
                      دفعة {i.seq} · {tag}
                    </div>
                  </div>
                  <span className="num shrink-0 text-[11.5px] font-black text-[var(--text)]">
                    {formatMoneyJOD(i.amount, currency, rates)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
