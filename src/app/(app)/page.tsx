"use client";

import { t } from "@/lib/i18n";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowUpLeft,
  Banknote,
  BellRing,
  CalendarDays,
  CircleAlert,
  Coins,
  Flame,
  Package,
  ReceiptText,
  ScrollText,
  TrendingUp,
} from "lucide-react";
import { api } from "@/lib/client";
import { useToast } from "@/components/toast";
import { Badge, Card, Empty, Skeleton, useCountUp } from "@/components/ui";
import { BarsChart, Sparkline } from "@/components/charts";
import CurrencySwitcher from "@/components/CurrencySwitcher";
import { useCurrency } from "@/components/useCurrency";
import { ProductImage } from "@/components/ProductImage";
import { formatMoneyJOD } from "@/lib/currency";
import {
  cls,
  fmtDateTime,
  fmtMoney,
  fmtNum,
  invoiceNo,
  relTime,
  type ActivityDTO,
  type SessionUserDTO,
} from "@/lib/shared";
import { can } from "@/lib/permissions";

type DashboardData = {
  kpis: {
    todayTotal: number;
    todayCount: number;
    yesterdayTotal: number;
    monthTotal: number;
    monthProfit: number;
    monthCount: number;
    totalUnits: number;
    activeProducts: number;
    lowCount: number;
    clientsCount: number;
  };
  series: Array<{ date: string; total: number; count: number }>;
  lowStock: Array<{
    id: number;
    name: string;
    stock: number;
    lowStockAt: number;
    imageUrl: string;
  }>;
  recentSales: Array<{
    id: number;
    total: number;
    status: string;
    createdAt: string;
    clientName: string;
  }>;
  recentActivity: ActivityDTO[];
  topProducts: Array<{
    productId: number;
    name: string;
    imageUrl: string;
    qty: number;
    revenue: number;
  }>;
};

const ENTITY_TONES: Record<string, string> = {
  منتج: "mint",
  عميل: "violet",
  فاتورة: "amber",
  مستخدم: "rose",
  نظام: "slate",
  دخول: "sky",
};

function Kpi({
  icon,
  label,
  value,
  money,
  sub,
  spark,
  tone,
  delay,
  currency,
  rates,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  money?: boolean;
  sub?: ReactNode;
  spark?: number[];
  tone: "mint" | "violet" | "amber" | "sky";
  delay: string;
  currency?: import("@/lib/currency").CurrencyCode;
  rates?: Record<import("@/lib/currency").CurrencyCode, number>;
}) {
  const v = useCountUp(value);
  const bg: Record<string, string> = {
    mint: "var(--accent-soft)",
    violet: "var(--overlay-2)",
    amber: "var(--alert-soft)",
    sky: "var(--overlay-1)",
  };
  const fg: Record<string, string> = {
    mint: "#ff4d4d",
    violet: "#ffffff",
    amber: "#ffb3b3",
    sky: "#e8e8e8",
  };
  return (
    <div className={cls("panel panel-hover anim-in p-5", delay)}>
      <div className="flex items-start justify-between gap-2">
        <div
          className="kpi-icon"
          style={{ background: bg[tone], color: fg[tone] }}
        >
          {icon}
        </div>
        {spark && <Sparkline points={spark} color={fg[tone]} />}
      </div>
      <div className="mt-4 text-[26px] font-black leading-none tracking-tight">
        <span className="num">{money && currency ? formatMoneyJOD(Math.round(v), currency, rates) : money ? fmtMoney(Math.round(v)) : fmtNum(Math.round(v))}</span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[12px] font-bold text-[var(--muted)]">{label}</span>
        {sub}
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-3 p-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-2/5" />
            <Skeleton className="h-2.5 w-3/5 opacity-60" />
          </div>
          <Skeleton className="h-6 w-16" />
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const toast = useToast();
  const { currency, settings, rates } = useCurrency();
  const [data, setData] = useState<DashboardData | null>(null);
  const [me, setMe] = useState<SessionUserDTO | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    api<DashboardData>("/api/dashboard")
      .then((d) => live && setData(d))
      .catch((e) => {
        setFailed(true);
        toast.push("err", e.message);
      });
    api<SessionUserDTO>("/api/auth/me").then((u) => live && setMe(u)).catch(() => {});
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const series7 = data?.series.slice(-7).map((s) => s.total) ?? [];
  const maxQty = Math.max(1, ...(data?.topProducts.map((t) => t.qty) ?? [1]));

  return (
    <div className="space-y-5">
        <div className="anim-in flex items-center justify-end gap-2">
        <CurrencySwitcher defaultCurrency={settings?.defaultCurrency} compact />
      </div>
      {/* KPIs */}
      {!data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[132px]" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            delay=""
            tone="mint"
            icon={<Banknote size={21} />}
            label={`مبيعات اليوم (${currency})`}
            value={data.kpis.todayTotal}
            money
            currency={currency}
            rates={rates}
            spark={series7}
            sub={
              <Badge tone={data.kpis.todayTotal >= data.kpis.yesterdayTotal ? "mint" : "rose"}>
                {data.kpis.todayCount} فاتورة
              </Badge>
            }
          />
          <Kpi
            delay="anim-d1"
            tone="violet"
            icon={<CalendarDays size={21} />}
            label={`مبيعات الشهر (${currency})`}
            value={data.kpis.monthTotal}
            money
            currency={currency}
            rates={rates}
            sub={<Badge tone="violet">{data.kpis.monthCount} فاتورة</Badge>}
          />
          {can(me, "finances.view_profit") ? (
            <Kpi
              delay="anim-d2"
              tone="amber"
              icon={<Coins size={21} />}
              label={`صافي ربح الشهر (${currency})`}
              value={data.kpis.monthProfit}
              money
              currency={currency}
              rates={rates}
              sub={
                <Badge tone="amber">
                  <TrendingUp size={12} /> بعد التكاليف
                </Badge>
              }
            />
          ) : (
            <Kpi
              delay="anim-d2"
              tone="amber"
              icon={<ReceiptText size={21} />}
              label={t("فواتير الشهر")}
              value={data.kpis.monthCount}
              sub={
                <Badge tone="amber">
                  إجمالي المبيعات فقط
                </Badge>
              }
            />
          )}
          <Kpi
            delay="anim-d3"
            tone="sky"
            icon={<Package size={21} />}
            label={t("وحدات بالمخزون")}
            value={data.kpis.totalUnits}
            sub={
              <Badge tone={data.kpis.lowCount > 0 ? "rose" : "sky"}>
                {data.kpis.lowCount > 0
                  ? `${data.kpis.lowCount} تنبيه نقص`
                  : `${data.kpis.activeProducts} صنف نشط`}
              </Badge>
            }
          />
        </div>
      )}

      {/* chart + top products */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Card
          className="anim-in anim-d1 xl:col-span-3"
          title="مبيعات آخر 14 يومًا"
          icon={<TrendingUp size={16} />}
          actions={
            <Badge tone="mint">
              إجمالي ({currency}): <span className="num">{formatMoneyJOD(data?.series.reduce((a, s) => a + s.total, 0) ?? 0, currency, rates)}</span>
            </Badge>
          }
          bodyClass="p-5"
        >
          {!data ? (
            <Skeleton className="h-[190px]" />
          ) : (
            <BarsChart
              data={data.series.map((s) => ({
                label: s.date.slice(5).replace("-", "/"),
                value: Math.round(s.total),
                sub: `${fmtDateTime(s.date).split("،")[0]} — ${s.count} فاتورة`,
              }))}
              format={(n) => formatMoneyJOD(n, currency, rates)}
            />
          )}
        </Card>

        <Card
          className="anim-in anim-d2 xl:col-span-2"
          title="الأصناف الأكثر مبيعًا — 30 يوم"
          icon={<Flame size={16} />}
          bodyClass="px-3 py-2"
        >
          {!data ? (
            <TableSkeleton />
          ) : data.topProducts.length === 0 ? (
            <Empty icon={<Flame size={20} />} title="لا توجد مبيعات بعد" hint="ستظهر هنا الأصناف الأعلى مبيعًا" />
          ) : (
            <ul className="divide-y divide-[var(--line-soft)]">
              {data.topProducts.map((p, i) => (
                <li key={p.productId} className="flex items-center gap-3 px-2 py-3">
                  <span className="w-5 text-center text-[13px] font-black text-[var(--faint)]">
                    {i + 1}
                  </span>
                  <ProductImage src={p.imageUrl} name={p.name} size={38} radius={11} />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="truncate text-[13px] font-extrabold">{p.name}</span>
                      <span className="num text-[12px] font-black text-[var(--mint)]">
                        {fmtNum(p.qty)} قطعة
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${(p.qty / maxQty) * 100}%`,
                          background: "linear-gradient(90deg,#ff2222,#8f0000)",
                        }}
                      />
                    </div>
                  </div>
                  <span className="num hidden w-28 text-end text-[12px] font-bold text-[var(--muted)] sm:block">
                    {formatMoneyJOD(p.revenue, currency, rates)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* low stock + recent sales + activity */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card
          className="anim-in anim-d2"
          title="تنبيهات المخزون"
          icon={<BellRing size={16} />}
          actions={
            <Link href="/products" className="link text-[12px]">
              إدارة الأصناف
            </Link>
          }
          bodyClass="px-3 py-2"
        >
          {!data ? (
            <TableSkeleton />
          ) : data.lowStock.length === 0 ? (
            <Empty icon={<Package size={20} />} title="المخزون بحالة ممتازة" hint="لا توجد أصناف تحت حد التنبيه" />
          ) : (
            <ul className="divide-y divide-[var(--line-soft)]">
              {data.lowStock.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-2 py-2.5">
                  <ProductImage src={p.imageUrl} name={p.name} size={36} radius={10} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-extrabold">{p.name}</div>
                    <div className="text-[11px] font-bold text-[var(--faint)]">
                      حد التنبيه: <span className="num">{p.lowStockAt}</span>
                    </div>
                  </div>
                  {p.stock === 0 ? (
                    <Badge tone="rose">
                      <CircleAlert size={11} /> نفد
                    </Badge>
                  ) : (
                    <Badge tone="amber">
                      متبقٍ <span className="num">{p.stock}</span>
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          className="anim-in anim-d3"
          title="أحدث الفواتير"
          icon={<ReceiptText size={16} />}
          actions={
            <Link href="/sales" className="link text-[12px]">
              كل الفواتير
            </Link>
          }
          bodyClass="px-3 py-2"
        >
          {!data ? (
            <TableSkeleton />
          ) : data.recentSales.length === 0 ? (
            <Empty
              icon={<ReceiptText size={20} />}
              title="لا توجد فواتير بعد"
              action={
                <Link href="/sales/new" className="btn btn-primary btn-sm">
                  <ArrowUpLeft size={14} /> أنشئ أول فاتورة
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-[var(--line-soft)]">
              {data.recentSales.map((s) => (
                <li key={s.id}>
                  <Link href={`/sales/${s.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-[var(--overlay-1)]">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="num text-[12.5px] font-extrabold">{invoiceNo(s.id)}</span>
                        {s.status === "cancelled" && <Badge tone="rose">ملغاة</Badge>}
                      </div>
                      <div className="truncate text-[11.5px] font-bold text-[var(--faint)]">
                        {s.clientName} • {relTime(s.createdAt)}
                      </div>
                    </div>
                    <span className={cls("num text-[13px] font-black", s.status === "cancelled" ? "text-[var(--faint)] line-through" : "text-[var(--mint)]")}>
                      {formatMoneyJOD(s.total, currency, rates)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {can(me, "activity.view") && (
          <Card
            className="anim-in anim-d4"
            title="آخر النشاطات"
            icon={<ScrollText size={16} />}
            bodyClass="px-3 py-2"
          >
            {!data ? (
              <TableSkeleton />
            ) : data.recentActivity.length === 0 ? (
              <Empty icon={<ScrollText size={20} />} title="لا يوجد نشاط بعد" />
            ) : (
              <ul className="divide-y divide-[var(--line-soft)]">
                {data.recentActivity.map((a) => (
                  <li key={a.id} className="flex items-start gap-2.5 px-2 py-2.5">
                    <Badge tone={ENTITY_TONES[a.entity] ?? "slate"} className="mt-0.5 shrink-0">
                      {a.entity}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] font-bold leading-5">{a.details || a.action}</div>
                      <div className="mt-0.5 text-[11px] font-bold text-[var(--faint)]">
                        {a.userName} • {relTime(a.createdAt)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
