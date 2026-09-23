"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  Coins,
  Download,
  Flame,
  ReceiptText,
  Scale,
  TrendingUp,
  Truck,
  Users,
} from "lucide-react";
import { api, downloadCsv } from "@/lib/client";
import { useToast } from "@/components/toast";
import { Badge, Btn, Card, Empty, Input, Skeleton } from "@/components/ui";
import { BarsChart } from "@/components/charts";
import CurrencySwitcher from "@/components/CurrencySwitcher";
import { useCurrency } from "@/components/useCurrency";
import { ProductImage } from "@/components/ProductImage";
import { formatMoneyJOD } from "@/lib/currency";
import {
  CLIENT_TYPES,
  cls,
  fmtNum,
  invoiceNo,
  type ClientType,
  type SessionUserDTO,
} from "@/lib/shared";

type ReportData = {
  range: { from: string; to: string };
  totals: {
    total: number;
    profit: number;
    shipping: number;
    count: number;
    avg: number;
    units: number;
  };
  series: Array<{ date: string; total: number; count: number }>;
  topProducts: Array<{
    productId: number;
    name: string;
    imageUrl: string;
    qty: number;
    revenue: number;
    profit: number;
  }>;
  topClients: Array<{
    clientId: number;
    name: string;
    type: ClientType;
    orders: number;
    revenue: number;
  }>;
};

type Preset = "today" | "week" | "month" | "thisMonth" | "custom";

function iso(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function presetRange(p: Preset): { from: string; to: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (p === "today") return { from: iso(today), to: iso(today) };
  if (p === "week") {
    const f = new Date(today);
    f.setDate(f.getDate() - 6);
    return { from: iso(f), to: iso(today) };
  }
  if (p === "thisMonth") {
    const f = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: iso(f), to: iso(today) };
  }
  const f = new Date(today);
  f.setDate(f.getDate() - 29);
  return { from: iso(f), to: iso(today) };
}

const PRESETS: Array<{ key: Preset; label: string }> = [
  { key: "today", label: "اليوم" },
  { key: "week", label: "آخر 7 أيام" },
  { key: "month", label: "آخر 30 يوم" },
  { key: "thisMonth", label: "الشهر الحالي" },
  { key: "custom", label: "مخصص" },
];

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="panel anim-in flex items-center gap-3.5 p-4">
      <div className="kpi-icon" style={{ background: tone, width: 40, height: 40 }}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="num truncate text-[17px] font-black leading-6">{value}</div>
        <div className="text-[11px] font-bold text-[var(--muted)]">{label}</div>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const toast = useToast();
  const { currency, settings, rates } = useCurrency();
  const [me, setMe] = useState<SessionUserDTO | null>(null);
  const [preset, setPreset] = useState<Preset>("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api<SessionUserDTO>("/api/auth/me").then(setMe).catch(() => {});
  }, []);

  const load = useCallback(async (f: string, t: string) => {
    setLoading(true);
    try {
      setData(await api<ReportData>(`/api/reports?from=${f}&to=${t}`));
    } catch (e) {
      toast.push("err", e instanceof Error ? e.message : "تعذر تحميل التقرير");
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (preset !== "custom") {
      const r = presetRange(preset);
      setFrom(r.from);
      setTo(r.to);
      load(r.from, r.to);
    }
  }, [preset]); // eslint-disable-line react-hooks/exhaustive-deps

  const margin = useMemo(
    () => (data && data.totals.total > 0 ? (data.totals.profit / (data.totals.total - data.totals.shipping || 1)) * 100 : 0),
    [data],
  );

  const daysLabel = useMemo(() => {
    if (!data) return "";
    return `${data.range.from} ← ${data.range.to}`;
  }, [data]);

  function exportProducts() {
    if (!data) return;
    downloadCsv(
      `top-products-${data.range.from}_${data.range.to}.csv`,
      ["الصنف", "الكمية المباعة", "الإيراد", "الربح"],
      data.topProducts.map((p) => [p.name, p.qty, p.revenue.toFixed(2), p.profit.toFixed(2)]),
    );
  }

  function exportClients() {
    if (!data) return;
    downloadCsv(
      `top-clients-${data.range.from}_${data.range.to}.csv`,
      ["العميل", "النوع", "عدد الفواتير", "إجمالي المشتريات"],
      data.topClients.map((c) => [c.name, CLIENT_TYPES[c.type], c.orders, c.revenue.toFixed(2)]),
    );
  }

  function exportDaily() {
    if (!data) return;
    downloadCsv(
      `daily-sales-${data.range.from}_${data.range.to}.csv`,
      ["التاريخ", "إجمالي المبيعات", "عدد الفواتير"],
      data.series.map((s) => [s.date, s.total.toFixed(2), s.count]),
    );
  }

  return (
    <div className="space-y-5">
      {/* presets */}
      <div className="anim-in flex flex-wrap items-center gap-2">
        <CurrencySwitcher defaultCurrency={settings?.defaultCurrency} compact />
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPreset(p.key)}
            className={cls(
              "rounded-xl border px-4 py-2.5 text-[12.5px] font-extrabold transition-all",
              preset === p.key
                ? "border-[rgba(255,34,34,.55)] bg-[rgba(255,34,34,.12)] text-[var(--mint)]"
                : "border-[var(--line-soft)] bg-white/[.02] text-[var(--muted)] hover:bg-white/[.05]",
            )}
          >
            {p.label}
          </button>
        ))}
        {preset === "custom" && (
          <>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="!w-auto" />
            <span className="text-[12px] font-bold text-[var(--faint)]">إلى</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="!w-auto" />
            <Btn size="sm" variant="primary" onClick={() => from && to && load(from, to)} loading={loading}>
              عرض
            </Btn>
          </>
        )}
        {data && (
          <Badge tone="slate" className="ms-auto">
            <CalendarDays size={12} /> <span className="num">{daysLabel}</span>
          </Badge>
        )}
      </div>

      {/* stats */}
      {!data ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[76px]" />
          ))}
        </div>
      ) : (
        <div className={cls("grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6", loading && "opacity-60 transition-opacity")}>
          <Stat icon={<Coins size={18} className="text-[var(--mint)]" />} tone="rgba(255,34,34,.12)" label={`إجمالي المبيعات (${currency})`} value={formatMoneyJOD(data.totals.total, currency, rates)} />
          {me?.role === "admin" && (
            <Stat icon={<TrendingUp size={18} className="text-[var(--amber)]" />} tone="rgba(255,122,122,.12)" label={`صافي الربح (هامش ${margin.toFixed(0)}%)`} value={formatMoneyJOD(data.totals.profit, currency, rates)} />
          )}
          <Stat icon={<ReceiptText size={18} className="text-[var(--violet)]" />} tone="rgba(255,255,255,.1)" label="عدد الفواتير" value={fmtNum(data.totals.count)} />
          <Stat icon={<Scale size={18} className="text-[var(--sky)]" />} tone="rgba(255,255,255,.07)" label={`متوسط الفاتورة (${currency})`} value={formatMoneyJOD(data.totals.avg, currency, rates)} />
          <Stat icon={<Truck size={18} className="text-[var(--rose)]" />} tone="rgba(255,43,43,.12)" label={`إجمالي الشحن (${currency})`} value={formatMoneyJOD(data.totals.shipping, currency, rates)} />
          <Stat icon={<BarChart3 size={18} className="text-[var(--mint)]" />} tone="rgba(255,34,34,.12)" label="وحدات مباعة" value={fmtNum(data.totals.units)} />
        </div>
      )}

      {/* daily chart */}
      <Card
        className="anim-in anim-d1"
        title="المبيعات اليومية"
        icon={<BarChart3 size={16} />}
        actions={
          <Btn size="xs" onClick={exportDaily} disabled={!data}>
            <Download size={13} /> CSV
          </Btn>
        }
        bodyClass="p-5"
      >
        {!data ? (
          <Skeleton className="h-[200px]" />
        ) : data.totals.count === 0 ? (
          <Empty icon={<BarChart3 size={20} />} title="لا توجد مبيعات في هذه الفترة" />
        ) : (
          <BarsChart
            height={210}
            data={data.series.map((s) => ({
              label: s.date.slice(5).replace("-", "/"),
              value: Math.round(s.total),
              sub: `${s.date} — ${s.count} فاتورة`,
            }))}
            format={(n) => formatMoneyJOD(n, currency, rates)}
          />
        )}
      </Card>

      {/* top products & clients */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card
          className="anim-in anim-d2 overflow-hidden"
          title={`الأصناف الأكثر مبيعًا (${currency})`}
          icon={<Flame size={16} />}
          actions={
            <Btn size="xs" onClick={exportProducts} disabled={!data || data.topProducts.length === 0}>
              <Download size={13} /> CSV
            </Btn>
          }
          bodyClass="overflow-x-auto"
        >
          {!data ? (
            <div className="space-y-3 p-5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-11" />)}</div>
          ) : data.topProducts.length === 0 ? (
            <Empty icon={<Flame size={20} />} title="لا توجد بيانات" />
          ) : (
            <table className="tbl min-w-[430px]">
              <thead>
                <tr>
                  <th>#</th>
                  <th>الصنف</th>
                  <th>الكمية</th>
                  <th>الإيراد</th>
                  {me?.role === "admin" && <th>الربح</th>}
                </tr>
              </thead>
              <tbody>
                {data.topProducts.map((p, i) => (
                  <tr key={p.productId}>
                    <td className="w-8">
                      <span className={cls("inline-flex h-6 w-6 items-center justify-center rounded-lg text-[11px] font-black", i < 3 ? "bg-[rgba(255,34,34,.14)] text-[var(--mint)]" : "bg-white/5 text-[var(--faint)]")}>
                        {i + 1}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <ProductImage src={p.imageUrl} name={p.name} size={32} radius={9} />
                        <span className="font-extrabold">{p.name}</span>
                      </div>
                    </td>
                    <td><span className="num font-black text-[var(--mint)]">{fmtNum(p.qty)}</span></td>
                    <td><span className="num font-bold">{formatMoneyJOD(p.revenue, currency, rates)}</span></td>
                    {me?.role === "admin" && <td><span className="num font-bold text-[var(--amber)]">{formatMoneyJOD(p.profit, currency, rates)}</span></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card
          className="anim-in anim-d3 overflow-hidden"
          title="العملاء الأكثر شراءً"
          icon={<Users size={16} />}
          actions={
            <Btn size="xs" onClick={exportClients} disabled={!data || data.topClients.length === 0}>
              <Download size={13} /> CSV
            </Btn>
          }
          bodyClass="overflow-x-auto"
        >
          {!data ? (
            <div className="space-y-3 p-5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-11" />)}</div>
          ) : data.topClients.length === 0 ? (
            <Empty icon={<Users size={20} />} title="لا توجد بيانات" />
          ) : (
            <table className="tbl min-w-[430px]">
              <thead>
                <tr>
                  <th>#</th>
                  <th>العميل</th>
                  <th>النوع</th>
                  <th>الفواتير</th>
                  <th>إجمالي المشتريات</th>
                </tr>
              </thead>
              <tbody>
                {data.topClients.map((c, i) => (
                  <tr key={c.clientId}>
                    <td className="w-8">
                      <span className={cls("inline-flex h-6 w-6 items-center justify-center rounded-lg text-[11px] font-black", i < 3 ? "bg-[rgba(255,255,255,.15)] text-[var(--violet)]" : "bg-white/5 text-[var(--faint)]")}>
                        {i + 1}
                      </span>
                    </td>
                    <td className="font-extrabold">{c.name}</td>
                    <td><Badge tone={c.type === "store" ? "mint" : c.type === "company" ? "violet" : "sky"}>{CLIENT_TYPES[c.type]}</Badge></td>
                    <td><span className="num font-black">{fmtNum(c.orders)}</span></td>
                    <td><span className="num font-black text-[var(--mint)]">{formatMoneyJOD(c.revenue, currency, rates)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}
