"use client";

import { useEffect, useState } from "react";
import { CURRENCIES, getPreferredCurrency, setPreferredCurrency, type CurrencyCode } from "@/lib/currency";
import { cls } from "@/lib/shared";

export default function CurrencySwitcher({
  defaultCurrency,
  compact,
}: {
  defaultCurrency?: CurrencyCode;
  compact?: boolean;
}) {
  const [cur, setCur] = useState<CurrencyCode>("JOD");

  useEffect(() => {
    setCur(getPreferredCurrency(defaultCurrency ?? "JOD"));
    const h = (e: Event) => {
      const v = (e as CustomEvent).detail as CurrencyCode;
      if (v) setCur(v);
    };
    window.addEventListener("cc:currency", h);
    return () => window.removeEventListener("cc:currency", h);
  }, [defaultCurrency]);

  function pick(c: CurrencyCode) {
    setCur(c);
    setPreferredCurrency(c);
  }

  return (
    <div className="flex items-center gap-1 rounded-xl border border-[var(--line-soft)] bg-white/[.03] p-1" title="عملة العرض — التحويل فوري">
      {(Object.keys(CURRENCIES) as CurrencyCode[]).map((c) => (
        <button
          key={c}
          onClick={() => pick(c)}
          className={cls(
            "rounded-lg px-2.5 py-1.5 text-[11.5px] font-black transition-all",
            cur === c
              ? "bg-[rgba(255,34,34,.15)] text-[var(--mint)] shadow"
              : "text-[var(--muted)] hover:bg-white/[.06] hover:text-white",
          )}
          title={CURRENCIES[c].label}
        >
          {compact ? c : `${c} • ${CURRENCIES[c].label}`}
        </button>
      ))}
    </div>
  );
}
