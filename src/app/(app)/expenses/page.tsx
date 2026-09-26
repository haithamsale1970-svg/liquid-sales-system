"use client";

import { t, tf } from "@/lib/i18n";

// إدارة المصاريف التشغيلية — تُخصم من إجمالي الربح لتظهر في «صافي الأرباح».
// - إضافة مصروف (تصنيف + مبلغ + ملاحظة) باسم المستخدم الذي أضافه.
// - فلترة بالفترة (اليوم / 7 أيام / الشهر / مخصص) + توزيع المصاريف على التصنيفات.
// - صافي الربح للفترة (إجمالي الربح − المصاريف) + تصدير Excel للتقارير.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Banknote,
  CalendarDays,
  Coins,
  Download,
  Plus,
  Receipt,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { api, downloadXlsx } from "@/lib/client";
import { useToast } from "@/components/toast";
import {
  Badge,
  Btn,
  Card,
  ConfirmDialog,
  Empty,
  Field,
  Input,
  Select,
  Skeleton,
  Textarea,
} from "@/components/ui";
import CurrencySwitcher from "@/components/CurrencySwitcher";
import { useCurrency } from "@/components/useCurrency";
import { formatMoneyJOD } from "@/lib/currency";
import {
  EXPENSE_CATEGORIES,
  cls,
  fmtDate,
  fmtNum,
  type ExpenseDTO,
} from "@/lib/shared";

type ReportTotals = {
  totals: { total: number; profit: number; expenses: number; netProfit: number };
};

type Preset = "today" | "week" | "month" | "thisMonth" | "all";

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
    return { from: iso(new Date(today.getFullYear(), today.getMonth(), 1)), to: iso(today) };
  }
  if (p === "all") return { from: "", to: "" };
  const f = new Date(today);
  f.setDate(f.getDate() - 29);
  return { from: iso(f), to: iso(today) };
}

const PRESETS: Array<{ key: Preset; label: string }> = [
  { key: "today", label: t("اليوم") },
  { key: "week", label: t("آخر 7 أيام") },
  { key: "month", label: t("آخر 30 يوم") },
  { key: "thisMonth", label: t("الشهر الحالي") },
  { key: "all", label: t("كل الفترات") },
];

export default function ExpensesPage() {
  const toast = useToast();
  const { currency, settings, rates } = useCurrency();
  const [rows, setRows] = useState<ExpenseDTO[] | null>(null);
  const [preset, setPreset] = useState<Preset>("month");
  const [from, setFrom] = useState(presetRange("month").from);
  const [to, setTo] = useState(presetRange("month").to);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ReportTotals["totals"] | null>(null);

  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ExpenseDTO | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(
    async (f = from, toDate = to) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (f) params.set("from", f);
        if (toDate) params.set("to", toDate);
        const list = await api<ExpenseDTO[]>(`/api/expenses?${params.toString()}`);
        setRows(list);
        if (f && toDate) {
          const r = await api<ReportTotals>(`/api/reports?from=${f}&to=${toDate}`);
          setReport(r.totals);
        } else {
          setReport(null);
        }
      } catch (e) {
        toast.push("err", e instanceof Error ? e.message : t("تعذر تحميل المصاريف"));
        setRows([]);
      } finally {
        setLoading(false);
      }
    },
    [from, to], // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = useMemo(() => (rows ?? []).reduce((a, r) => a + r.amount, 0), [rows]);

  const byCategory = useMemo(() => {
    const m = new Map<string, { amount: number; count: number }>();
    for (const r of rows ?? []) {
      const key = r.category || t("أخرى");
      const prev = m.get(key) ?? { amount: 0, count: 0 };
      m.set(key, { amount: prev.amount + r.amount, count: prev.count + 1 });
    }
    return [...m.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.amount - a.amount);
  }, [rows]);

  function applyPreset(p: Preset) {
    setPreset(p);
    const r = presetRange(p);
    setFrom(r.from);
    setTo(r.to);
    load(r.from, r.to);
  }

  async function addExpense() {
    if (saving) return;
    const value = Math.round((Number(amount) || 0) * 1000) / 1000;
    if (!(value > 0)) {
      toast.push("info", t("أدخل مبلغ المصروف أولاً"));
      return;
    }
    const finalCategory =
      category === "__custom__" ? customCategory.trim() || t("أخرى") : category;
    setSaving(true);
    try {
      await api("/api/expenses", {
        method: "POST",
        body: { category: finalCategory, amount: value, note },
      });
      toast.push("ok", tf("تم تسجيل مصروف {n} ({cat})", { n: value, cat: finalCategory }));
      setAmount("");
      setNote("");
      setCustomCategory("");
      await load();
    } catch (e) {
      toast.push("err", e instanceof Error ? e.message : t("تعذر حفظ المصروف"));
    } finally {
      setSaving(false);
    }
  }

  async function doDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await api(`/api/expenses/${deleteTarget.id}`, { method: "DELETE" });
      toast.push("ok", t("تم حذف المصروف"));
      setDeleteTarget(null);
      await load();
    } catch (e) {
      toast.push("err", e instanceof Error ? e.message : t("تعذر الحذف"));
    } finally {
      setDeleting(false);
    }
  }

  function exportExcel() {
    const list = rows ?? [];
    downloadXlsx(`${t("المصاريف-")}${from || t("الكل")}_${to || iso(new Date())}`, [
      {
        name: t("المصاريف"),
        rows: [
          [t("الفترة"), from && to ? `${from} ← ${to}` : t("كل الفترات")],
          [t("إجمالي المصاريف"), total.toFixed(2)],
          [t("عدد المصاريف"), list.length],
          [],
          [t("التاريخ"), t("التصنيف"), t("المبلغ"), t("أضافه"), t("ملاحظة")],
          ...list.map((r) => [
            r.createdAt.slice(0, 10),
            r.category || t("أخرى"),
            r.amount.toFixed(2),
            r.userName,
            r.note,
          ]),
          [],
          [t("الإجمالي"), "", total.toFixed(2), "", ""],
        ],
      },
      {
        name: t("حسب التصنيف"),
        rows: [
          [t("التصنيف"), t("عدد المصاريف"), t("الإجمالي"), t("النسبة %")],
          ...byCategory.map((c) => [
            c.name,
            c.count,
            c.amount.toFixed(2),
            total > 0 ? ((c.amount / total) * 100).toFixed(1) : "0",
          ]),
        ],
      },
      {
        name: t("صافي الأرباح"),
        rows: [
          [t("البند"), t("المبلغ")],
          [t("إجمالي المبيعات"), (report?.total ?? 0).toFixed(2)],
          [t("إجمالي الربح"), (report?.profit ?? 0).toFixed(2)],
          [t("المصاريف التشغيلية"), (report?.expenses ?? total).toFixed(2)],
          [t("صافي الربح"), (report?.netProfit ?? 0).toFixed(2)],
        ],
      },
    ]);
    toast.push("ok", t("تم تنزيل تقرير المصاريف وصافي الأرباح"));
  }

  return (
    <div className="space-y-5">
      {/* ===== فلاتر الفترة ===== */}
      <div className="anim-in flex flex-wrap items-center gap-2">
        <CurrencySwitcher defaultCurrency={settings?.defaultCurrency} compact />
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => applyPreset(p.key)}
            className={cls(
              "rounded-xl border px-3.5 py-2 text-[12.5px] font-extrabold transition-all",
              preset === p.key
                ? "border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--mint)]"
                : "border-[var(--line-soft)] bg-[var(--overlay-1)] text-[var(--muted)] hover:bg-[var(--overlay-2)]",
            )}
          >
            {p.label}
          </button>
        ))}
        <Input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="!w-auto"
        />
        <span className="text-[12px] font-bold text-[var(--faint)]">{t("إلى")}</span>
        <Input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="!w-auto"
        />
        <Btn size="sm" variant="primary" onClick={() => load()} loading={loading}>
          {t("عرض")}
        </Btn>
        <Badge tone="slate" className="ms-auto">
          <CalendarDays size={12} />{" "}
          <span className="num">{from && to ? `${from} ← ${to}` : t("كل الفترات")}</span>
        </Badge>
      </div>

      {/* ===== مؤشرات ===== */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          icon={<Coins size={17} />}
          tone="rose"
          label={`${t("إجمالي المصاريف (")}${currency})`}
          value={formatMoneyJOD(total, currency, rates)}
        />
        <Stat
          icon={<TrendingUp size={17} />}
          tone="mint"
          label={`${t("إجمالي الربح (")}${currency})`}
          value={formatMoneyJOD(report?.profit ?? 0, currency, rates)}
        />
        <Stat
          icon={<TrendingDown size={17} />}
          tone="amber"
          label={`${t("صافي الربح (")}${currency})`}
          value={formatMoneyJOD(report?.netProfit ?? 0, currency, rates)}
        />
        <Stat
          icon={<Receipt size={17} />}
          tone="violet"
          label={t("عدد المصاريف")}
          value={fmtNum((rows ?? []).length)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* ===== إضافة مصروف ===== */}
        <Card
          className="anim-in anim-d1 self-start"
          title={t("إضافة مصروف تشغيلي")}
          icon={<Plus size={16} />}
          bodyClass="space-y-4 p-5"
        >
          <Field label={t("التصنيف")}>
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(c)}
                </option>
              ))}
              <option value="__custom__">{t("تصنيف آخر…")}</option>
            </Select>
          </Field>
          {category === "__custom__" && (
            <Field label={t("اسم التصنيف المخصص")}>
              <Input
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder={t("مثال: عمولة مندوب")}
              />
            </Field>
          )}
          <Field label={`${t("المبلغ (")}${currency})`}>
            <Input
              type="number"
              min="0"
              step="any"
              dir="ltr"
              className="num"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </Field>
          <Field label={t("ملاحظة (اختياري)")}>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("تفاصيل المصروف — تُدرج في التقارير وسجل النشاط")}
            />
          </Field>
          <Btn variant="primary" className="w-full" onClick={addExpense} loading={saving}>
            <Banknote size={15} /> {t("تسجيل المصروف")}
          </Btn>
          <p className="text-[11px] font-semibold leading-5 text-[var(--faint)]">
            {t("تُخصم المصاريف من الربح في التقارير، ويظهر «صافي الربح» في لوحة التحكم والتقارير مع تفصيل كل مصروف واسم من أضافه.")}
          </p>
        </Card>

        {/* ===== القائمة ===== */}
        <div className="space-y-4 xl:col-span-2">
          <Card
            className="anim-in anim-d2"
            title={t("توزيع المصاريف على التصنيفات")}
            icon={<TrendingDown size={16} />}
            bodyClass="space-y-2.5 p-4"
          >
            {!rows ? (
              <Skeleton className="h-24" />
            ) : byCategory.length === 0 ? (
              <p className="py-3 text-center text-[12.5px] font-bold text-[var(--faint)]">
                {t("لا مصاريف في هذه الفترة")}
              </p>
            ) : (
              byCategory.map((c) => (
                <div key={c.name}>
                  <div className="flex items-center justify-between text-[12.5px] font-extrabold">
                    <span>
                      {c.name}{" "}
                      <span className="num text-[11px] font-bold text-[var(--faint)]">
                        ({fmtNum(c.count)})
                      </span>
                    </span>
                    <span className="num">
                      {formatMoneyJOD(c.amount, currency, rates)}
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--overlay-2)]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${total > 0 ? Math.max(3, (c.amount / total) * 100) : 0}%`,
                        background: "linear-gradient(90deg,var(--brand-1),var(--brand-2))",
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </Card>

          <Card
            className="anim-in anim-d3 overflow-hidden"
            title={t("سجل المصاريف")}
            icon={<Receipt size={16} />}
            actions={
              <div className="flex items-center gap-2">
                <Btn size="xs" onClick={exportExcel} disabled={!rows?.length}>
                  <Download size={13} /> Excel
                </Btn>
                <Badge tone="rose">
                  <span className="num">{formatMoneyJOD(total, currency, rates)}</span>
                </Badge>
              </div>
            }
            bodyClass="overflow-x-auto"
          >
            {!rows ? (
              <div className="space-y-3 p-5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-11" />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <Empty
                icon={<Receipt size={22} />}
                title={t("لا مصاريف مسجّلة في هذه الفترة")}
                hint={t("أضف المصاريف (إيجار، فواتير، رواتب، نقل…) لتظهر في صافي الأرباح")}
              />
            ) : (
              <table className="tbl min-w-[640px]">
                <thead>
                  <tr>
                    <th>{t("التاريخ")}</th>
                    <th>{t("التصنيف")}</th>
                    <th>{t("المبلغ")}</th>
                    <th>{t("أضافه")}</th>
                    <th>{t("ملاحظة")}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="text-[11.5px] font-bold text-[var(--faint)]">
                        {fmtDate(r.createdAt)}
                      </td>
                      <td>
                        <Badge tone="amber">{r.category || t("أخرى")}</Badge>
                      </td>
                      <td className="num font-black text-[var(--rose)]">
                        {formatMoneyJOD(r.amount, currency, rates)}
                      </td>
                      <td className="text-[12px] font-bold text-[var(--muted)]">
                        {r.userName || "—"}
                      </td>
                      <td className="max-w-[220px] truncate text-[12px] font-bold text-[var(--muted)]">
                        {r.note || "—"}
                      </td>
                      <td>
                        <div className="flex justify-end">
                          <button
                            className="icon-btn danger"
                            title={t("حذف")}
                            onClick={() => setDeleteTarget(r)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={doDelete}
        loading={deleting}
        title={t("حذف مصروف")}
        message={`${t("سيتم حذف مصروف")}${deleteTarget?.amount ?? 0} (${deleteTarget?.category ?? ""}${t(") من السجل، وسيتأثر صافي الربح لهذه الفترة.")}`}
        confirmText={t("حذف")}
      />
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
  tone: "rose" | "mint" | "amber" | "violet";
}) {
  const bg: Record<string, string> = {
    rose: "var(--critical-soft)",
    mint: "var(--accent-soft)",
    amber: "var(--alert-soft)",
    violet: "var(--overlay-2)",
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