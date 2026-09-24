"use client";

// إدارة المرتجعات واستبدال البضائع:
// كل مرتجع مرتبط بفاتورة، ويُظهر الأصناف العائدة للمخزون (دخول) والأصناف البديلة
// التي خرجت (استبدال) مع الفرق المالي — والمخزون يُعدَّل تلقائيًا وقت التسجيل.
// تُدار المرتجعات من صفحة الفاتورة نفسها (/sales/[id] ← مرتجع / استبدال).

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Download,
  RefreshCw,
  Undo2,
} from "lucide-react";
import { api, downloadXlsx } from "@/lib/client";
import { useToast } from "@/components/toast";
import { Badge, Btn, Card, Empty, Field, Input, Skeleton } from "@/components/ui";
import CurrencySwitcher from "@/components/CurrencySwitcher";
import { useCurrency } from "@/components/useCurrency";
import { formatMoneyJOD } from "@/lib/currency";
import {
  cls,
  fmtDateTime,
  fmtNum,
  invoiceNo,
  type ReturnDTO,
} from "@/lib/shared";

export default function ReturnsPage() {
  const toast = useToast();
  const { currency, settings, rates } = useCurrency();
  const [rows, setRows] = useState<ReturnDTO[] | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await api<ReturnDTO[]>("/api/returns"));
    } catch (e) {
      toast.push("err", e instanceof Error ? e.message : "تعذر تحميل المرتجعات");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const list = rows ?? [];
    return list.filter((r) => {
      const day = r.createdAt.slice(0, 10);
      if (from && day < from) return false;
      if (to && day > to) return false;
      return true;
    });
  }, [rows, from, to]);

  const stats = useMemo(() => {
    const list = filtered;
    let returnedQty = 0;
    let exchangeQty = 0;
    let refundNet = 0;
    for (const r of list) {
      for (const it of r.items) {
        if (it.direction === "in") returnedQty += it.quantity;
        else exchangeQty += it.quantity;
      }
      refundNet += r.refund;
    }
    return { count: list.length, returnedQty, exchangeQty, refundNet };
  }, [filtered]);

  function exportExcel() {
    const list = filtered;
    downloadXlsx(
      `المرتجعات-${from || "البداية"}_${to || new Date().toISOString().slice(0, 10)}`,
      [
        {
          name: "المرتجعات",
          rows: [
            ["عدد المرتجعات", list.length],
            ["كميات مرتجعة للمخزون", stats.returnedQty],
            ["كميات بديلة (استبدال)", stats.exchangeQty],
            ["إجمالي الفرق المالي", stats.refundNet.toFixed(2)],
            [],
            ["المرجع", "الفاتورة", "العميل", "التاريخ", "الفرق المالي", "طريقة الدفع", "السبب", "المنفّذ", "ملاحظة"],
            ...list.map((r) => [
              `RET-${r.id}`,
              invoiceNo(r.saleId),
              r.clientName,
              r.createdAt.slice(0, 19).replace("T", " "),
              r.refund.toFixed(2),
              r.method,
               r.reason,
              r.userName,
              r.note,
            ]),
          ],
        },
        {
          name: "أصناف المرتجعات",
          rows: [
            ["المرجع", "الفاتورة", "الصنف", "الحجم", "النيكوتين", "السعر", "النوع", "الكمية", "سعر الوحدة", "القيمة"],
            ...list.flatMap((r) =>
              r.items.map((it) => [
                `RET-${r.id}`,
                invoiceNo(r.saleId),
                it.productName,
                it.size,
                it.nicotine,
                it.priceType === "wholesale" ? "جملة" : "أفراد",
                it.direction === "in" ? "مرتجع (دخول)" : "بديل (خروج)",
                it.quantity,
                it.price.toFixed(2),
                (it.price * it.quantity).toFixed(2),
              ]),
            ),
          ],
        },
      ],
    );
    toast.push("ok", "تم تنزيل تقرير المرتجعات والاستبدال");
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          icon={<Undo2 size={17} className="text-white" />}
          tone="violet"
          label="عدد المرتجعات"
          value={fmtNum(stats.count)}
        />
        <Stat
          icon={<ArrowDownToLine size={17} className="text-[var(--mint)]" />}
          tone="mint"
          label="قطع عادت للمخزون"
          value={fmtNum(stats.returnedQty)}
        />
        <Stat
          icon={<ArrowUpFromLine size={17} className="text-[var(--danger)]" />}
          tone="rose"
          label="قطع بديلة خرجت"
          value={fmtNum(stats.exchangeQty)}
        />
        <Stat
          icon={<Undo2 size={17} className="text-[var(--amber)]" />}
          tone="amber"
          label={`صافي الفرق المالي (${currency})`}
          value={formatMoneyJOD(stats.refundNet, currency, rates)}
        />
      </div>

      <div className="anim-in flex flex-wrap items-end gap-2.5">
        <Field label="من تاريخ">
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="!w-auto"
          />
        </Field>
        <Field label="إلى تاريخ">
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="!w-auto"
          />
        </Field>
        <Btn size="sm" variant="primary" onClick={load} loading={loading}>
          <RefreshCw size={14} /> تحديث
        </Btn>
        <Btn size="sm" onClick={exportExcel} disabled={!filtered.length}>
          <Download size={14} /> Excel
        </Btn>
        <CurrencySwitcher defaultCurrency={settings?.defaultCurrency} compact />
        <Badge tone="slate" className="ms-auto">
          إنشاء المرتجع يكون من داخل صفحة الفاتورة (زر «مرتجع / استبدال»)
        </Badge>
      </div>

      <Card
        className="anim-in anim-d1 overflow-hidden"
        title="سجل المرتجعات والاستبدال"
        icon={<Undo2 size={16} />}
        bodyClass="space-y-3 p-3"
      >
        {!rows ? (
          <div className="space-y-3 p-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Empty
            icon={<Undo2 size={22} />}
            title="لا مرتجعات في هذه الفترة"
            hint="عند إرجاع صنف من فاتورة، يعود للمخزون تلقائيًا ويظهر هنا مع تفاصيله"
          />
        ) : (
          filtered.map((r) => (
            <div
              key={r.id}
              className="rounded-2xl border border-[var(--line-soft)] bg-white/[.02] p-3.5"
            >
              <div className="flex flex-wrap items-center gap-2.5">
                <Badge tone="violet" className="num">
                  RET-{r.id}
                </Badge>
                <Link
                  href={`/sales/${r.saleId}`}
                  className="num text-[13px] font-black hover:text-[var(--mint)]"
                >
                  {invoiceNo(r.saleId)}
                </Link>
                <span className="text-[13px] font-extrabold">{r.clientName}</span>
                <span className="text-[11px] font-bold text-[var(--faint)]">
                  {fmtDateTime(r.createdAt)} • {r.userName || "—"}
                </span>
                <span
                  className={cls(
                    "num ms-auto text-[14px] font-black",
                    r.refund > 0
                      ? "text-[var(--mint)]"
                      : r.refund < 0
                        ? "text-[var(--danger)]"
                        : "text-[var(--faint)]",
                  )}
                >
                  {r.refund > 0 ? "+" : ""}
                  {formatMoneyJOD(r.refund, currency, rates)}
                </span>
              </div>

              <div className="mt-1.5 rounded-lg border border-[var(--line-soft)] bg-white/[.03] px-2.5 py-1.5 text-[11.5px] font-extrabold text-[var(--muted)]">
                السبب: {r.reason}
              </div>

              {r.note && (
                <p className="mt-1.5 text-[11.5px] font-bold text-[var(--muted)]">
                  {r.note}
                </p>
              )}

              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {r.items.map((it, i) => (
                  <span
                    key={i}
                    className={cls(
                      "flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-bold",
                      it.direction === "in"
                        ? "border-[rgba(255,34,34,.35)] bg-[rgba(255,34,34,.08)] text-[var(--mint)]"
                        : "border-[rgba(255,43,43,.35)] bg-[rgba(255,43,43,.08)] text-[var(--danger)]",
                    )}
                  >
                    {it.direction === "in" ? (
                      <ArrowDownToLine size={11} />
                    ) : (
                      <ArrowUpFromLine size={11} />
                    )}
                    {it.productName}
                    {it.size && (
                      <span className="opacity-70">
                        {" "}• {it.size}/{it.nicotine} • {it.priceType === "wholesale" ? "جملة" : "أفراد"}
                      </span>
                    )}
                    <span className="num">×{it.quantity}</span>
                    <span className="num opacity-70">
                      {formatMoneyJOD(it.price * it.quantity, currency, rates)}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "mint" | "rose" | "amber" | "violet";
}) {
  const bg: Record<string, string> = {
    mint: "rgba(255,34,34,.12)",
    rose: "rgba(255,43,43,.12)",
    amber: "rgba(255,122,122,.12)",
    violet: "rgba(255,255,255,.1)",
  };
  return (
    <div className="panel anim-in flex items-center gap-3 p-3.5">
      <div className="kpi-icon" style={{ background: bg[tone], width: 38, height: 38 }}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="truncate text-[11px] font-bold text-[var(--faint)]">{label}</div>
        <div className="num truncate text-[15px] font-black">{value}</div>
      </div>
    </div>
  );
}