"use client";

// بحث ذكي عن العميل (Autocomplete) داخل الفاتورة:
// - نتائج مطابقة فورية أثناء الكتابة (الاسم / الهاتف / الهاتف الثاني).
// - تنقّل بالكيبورد (↑ ↓ Enter Esc) — يعمل مع الماوس ولوحة المفاتيح.
// - زر سريع لإضافة عميل جديد متاح للمدير فقط.
// - يعرض تاريخ العميل المختصر: عدد الطلبات، إجمالي مشترياته، دينه، آخر طلب.

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Plus, Search, UserPlus, X } from "lucide-react";
import {
  CLIENT_TYPES,
  cls,
  fmtDate,
  fmtNum,
  type ClientDTO,
} from "@/lib/shared";
import { useCurrency } from "@/components/useCurrency";
import { formatMoneyJOD } from "@/lib/currency";

function normalizeArabic(value: string) {
  return value
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^ال/, "");
}

export default function ClientPicker({
  clients,
  value,
  onChange,
  onQuickAdd,
  canQuickAdd = false,
}: {
  clients: ClientDTO[];
  value: string;
  onChange: (id: number | null) => void;
  onQuickAdd: (name: string) => void;
  canQuickAdd?: boolean;
}) {
  const { currency, rates } = useCurrency();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => clients.find((c) => String(c.id) === value) ?? null,
    [clients, value],
  );

  const results = useMemo(() => {
    const n = normalizeArabic(q);
    const list = n
      ? clients.filter((c) => normalizeArabic(`${c.name} ${c.phone} ${c.phone2}`).includes(n))
      : clients;
    return list.slice(0, 50);
  }, [clients, q]);

  useEffect(() => {
    setHi(0);
  }, [q]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQ("");
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function pick(c: ClientDTO) {
    onChange(c.id);
    setOpen(false);
    setQ("");
    inputRef.current?.blur();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHi((i) => Math.min(i + 1, Math.max(0, results.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results.length) pick(results[hi]);
      else if (canQuickAdd && q.trim().length >= 2) {
        onQuickAdd(q.trim());
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setQ("");
      inputRef.current?.blur();
    }
  }

  const inputValue = open ? q : selected?.name ?? "";

  return (
    <div className="relative" ref={boxRef}>
      <div className="relative">
        <input
          ref={inputRef}
          className="inp ps-9"
          placeholder="اكتب اسم العميل أو رقم هاتفه…"
          value={inputValue}
          onFocus={() => {
            setOpen(true);
            setQ("");
          }}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            if (!e.target.value) onChange(null);
          }}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={open}
          aria-controls="client-picker-list"
          autoComplete="off"
        />
        <Search
          size={15}
          className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-[var(--faint)]"
        />
        {(selected || q) && (
          <button
            type="button"
            aria-label="مسح العميل"
            className="icon-btn !absolute end-2 top-1/2 !h-7 !w-7 -translate-y-1/2"
            onClick={() => {
              if (q) {
                setQ("");
                inputRef.current?.focus();
              } else {
                onChange(null);
              }
            }}
          >
            <X size={13} />
          </button>
        )}
      </div>

      {open && (
        <div
          id="client-picker-list"
          className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-[var(--line)] bg-[#0b0b0b] shadow-2xl shadow-black/60"
        >
          <div className="max-h-[260px] overflow-y-auto p-1.5">
            {results.length === 0 ? (
              <div className="px-3 py-4 text-center text-[12px] font-bold text-[var(--faint)]">
                لا يوجد عميل مطابق «{q}»
              </div>
            ) : (
              results.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  onMouseEnter={() => setHi(i)}
                  onClick={() => pick(c)}
                  className={cls(
                    "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-start transition-colors",
                    i === hi ? "bg-white/[.07]" : "hover:bg-white/[.04]",
                    String(c.id) === value && "bg-[rgba(255,34,34,.1)]",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[13px] font-extrabold">
                        {c.name}
                      </span>
                      <span className="shrink-0 rounded-md bg-white/[.06] px-1.5 py-0.5 text-[10px] font-bold text-[var(--muted)]">
                        {CLIENT_TYPES[c.type]}
                      </span>
                      {String(c.id) === value && (
                        <Check size={12} className="shrink-0 text-[var(--mint)]" />
                      )}
                    </div>
                    <div
                      className="num mt-0.5 truncate text-[11px] font-bold text-[var(--faint)]"
                      dir="ltr"
                    >
                      {[c.phone, c.phone2].filter(Boolean).join(" • ") || "بدون هاتف"}
                    </div>
                  </div>
                  <div className="shrink-0 text-end">
                    <div className="num text-[11.5px] font-black text-[var(--muted)]">
                      {fmtNum(c.ordersCount)} فاتورة
                    </div>
                    {c.debt > 0 ? (
                      <div className="num text-[11px] font-black text-[var(--danger)]">
                        دين {formatMoneyJOD(c.debt, currency, rates)}
                      </div>
                    ) : (
                      <div className="num text-[11px] font-bold text-[var(--faint)]">
                        {formatMoneyJOD(c.totalSpent, currency, rates)}
                      </div>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          {canQuickAdd && (
            <button
              type="button"
              onClick={() => {
                onQuickAdd(q.trim());
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 border-t border-[var(--line-soft)] bg-white/[.02] px-3.5 py-3 text-[12.5px] font-extrabold text-[var(--mint)] hover:bg-white/[.05]"
            >
              <UserPlus size={14} />
              {q.trim() ? `إضافة عميل جديد: «${q.trim()}»` : "إضافة عميل جديد"}
              <Plus size={13} className="ms-auto" />
            </button>
          )}
        </div>
      )}

      {selected && (
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Chip label="عدد الطلبات" value={fmtNum(selected.ordersCount)} />
          <Chip
            label="إجمالي مشترياته"
            value={formatMoneyJOD(selected.totalSpent, currency, rates)}
          />
          <Chip
            label="الرصيد (دين)"
            value={
              selected.debt > 0
                ? formatMoneyJOD(selected.debt, currency, rates)
                : "لا يوجد"
            }
            danger={selected.debt > 0}
          />
          <Chip
            label="آخر طلب"
            value={selected.lastSaleAt ? fmtDate(selected.lastSaleAt) : "—"}
          />
        </div>
      )}
    </div>
  );
}

function Chip({
  label,
  value,
  danger,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--line-soft)] bg-white/[.03] px-3 py-2">
      <div className="text-[10.5px] font-bold text-[var(--faint)]">{label}</div>
      <div
        className={cls(
          "num mt-0.5 text-[13px] font-black",
          danger ? "text-[var(--danger)]" : "text-[var(--mint)]",
        )}
      >
        {value}
      </div>
    </div>
  );
}
