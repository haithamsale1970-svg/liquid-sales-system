"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Plus, Trash2, Wallet } from "lucide-react";
import { api } from "@/lib/client";
import { useToast } from "@/components/toast";
import { Btn, Field, Input } from "@/components/ui";
import {
  cls,
  type InstallmentDTO,
  type InstallmentPlanDTO,
} from "@/lib/shared";
import { useCurrency } from "@/components/useCurrency";
import { useLang } from "./LanguageProvider";
import { formatMoneyJOD } from "@/lib/currency";

/** تاريخ بصيغة yyyy-mm-dd بالتوقيت المحلي (تفادي فروق UTC). */
function todayISO(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

type Row = { amount: string; dueDate: string; note: string };

/**
 * محرّر خطة التقسيط: يقسم المبلغ المتبقي على دفعات بتواريخ استحقاق محددة.
 * يظهر عند اختيار الدفع الآجل (ذمم) ومع صلاحية "نظام التقسيط والذمم".
 */
export default function InstallmentPlanner({
  saleId,
  owed,
  editable,
}: {
  /** null = فاتورة جديدة (لا حفظ بعد) */
  saleId: number | null;
  owed: number;
  editable: boolean;
}) {
  const toast = useToast();
  const { t } = useLang();
  const { currency, rates } = useCurrency();
  const [rows, setRows] = useState<Row[]>([]);
  const [existing, setExisting] = useState<InstallmentDTO[]>([]);
  const [saving, setSaving] = useState(false);

  // خطة مقترحة افتراضيًا: 3 دفعات شهرية متساوية.
  useEffect(() => {
    if (owed <= 0) {
      setRows([]);
      return;
    }
    const each = Math.floor((owed / 3) * 100) / 100;
    const rest = Number((owed - each * 2).toFixed(2));
    setRows([
      { amount: each.toFixed(2), dueDate: todayISO(0), note: "" },
      { amount: each.toFixed(2), dueDate: todayISO(30), note: "" },
      { amount: rest.toFixed(2), dueDate: todayISO(60), note: "" },
    ]);
  }, [owed]);

  useEffect(() => {
    if (!saleId) {
      setExisting([]);
      return;
    }
    api<InstallmentDTO[]>(`/api/sales/${saleId}/installments`)
      .then(setExisting)
      .catch(() => setExisting([]));
  }, [saleId]);

  const planTotal = useMemo(
    () => rows.reduce((a, r) => a + (Number(r.amount) || 0), 0),
    [rows],
  );
  const diff = Number((owed - planTotal).toFixed(2));
  const valid =
    rows.length > 0 &&
    planTotal > 0 &&
    planTotal <= owed + 0.01 &&
    rows.every((r) => Number(r.amount) > 0 && r.dueDate);

  function setRow(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  /** تقسيم متساوٍ على n دفعات بفارق 30 يومًا. */
  function splitEvenly(n: number) {
    if (owed <= 0) return;
    const each = Math.floor((owed / n) * 100) / 100;
    setRows(
      Array.from({ length: n }, (_, i) => ({
        amount:
          i === n - 1
            ? Number((owed - each * (n - 1)).toFixed(2)).toFixed(2)
            : each.toFixed(2),
        dueDate: todayISO(i * 30),
        note: "",
      })),
    );
  }

  async function save() {
    if (!saleId || !valid || saving) return;
    setSaving(true);
    try {
      const plan: InstallmentPlanDTO[] = rows.map((r) => ({
        amount: Number(Number(r.amount).toFixed(2)),
        // نثبّت الساعة 12:00 لتفادي انزلاق التاريخ حسب المناطق الزمنية
        dueDate: new Date(`${r.dueDate}T12:00:00`).toISOString(),
        note: r.note,
      }));
      const res = await api<{ plan: InstallmentDTO[] }>(
        `/api/sales/${saleId}/installments`,
        { method: "PUT", body: { installments: plan } },
      );
      setExisting(res.plan);
      toast.push("ok", "تم حفظ خطة التقسيط");
    } catch (e) {
      toast.push("err", e instanceof Error ? e.message : "تعذر حفظ الخطة");
    } finally {
      setSaving(false);
    }
  }

  async function togglePaid(ins: InstallmentDTO) {
    if (!saleId) return;
    try {
      await api(`/api/sales/${saleId}/installments`, {
        method: "PATCH",
        body: { id: ins.id, paid: ins.status !== "paid" },
      });
      setExisting(await api<InstallmentDTO[]>(`/api/sales/${saleId}/installments`));
    } catch (e) {
      toast.push("err", e instanceof Error ? e.message : "تعذر التحديث");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[13px] font-extrabold">
          <CalendarClock size={15} className="text-[var(--mint)]" />
          {t("خطة التقسيط والذمم")}
        </div>
        {editable && saleId && (
          <div className="flex flex-wrap items-center gap-1.5">
            {[2, 3, 4, 6].map((n) => (
              <Btn key={n} size="xs" onClick={() => splitEvenly(n)}>
                {n} دفعات
              </Btn>
            ))}
          </div>
        )}
      </div>

      {/* ملخص المبالغ */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--line-soft)] bg-[var(--overlay-1)] p-3">
          <div className="text-[11px] font-bold text-[var(--faint)]">{t("المبلغ المتبقي")}</div>
          <div className="num mt-0.5 text-[15px] font-black text-[var(--mint)]">
            {formatMoneyJOD(owed, currency, rates)}
          </div>
        </div>
        <div className="rounded-xl border border-[var(--line-soft)] bg-[var(--overlay-1)] p-3">
          <div className="text-[11px] font-bold text-[var(--faint)]">{t("إجمالي المجدول")}</div>
          <div className="num mt-0.5 text-[15px] font-black text-[var(--text)]">
            {formatMoneyJOD(planTotal, currency, rates)}
          </div>
        </div>
        <div
          className={cls(
            "rounded-xl border p-3",
            diff === 0
              ? "border-[var(--accent-line)] bg-[var(--accent-soft)]"
              : "border-[var(--alert-line)] bg-[var(--alert-soft)]",
          )}
        >
          <div className="text-[11px] font-bold text-[var(--faint)]">
            {diff === 0
              ? t("مطابق تمامًا")
              : diff > 0
                ? t("باقي غير مجدول")
                : t("تجاوز المتبقي")}
          </div>
          <div
            className={cls(
              "num mt-0.5 text-[15px] font-black",
              diff === 0 ? "text-[var(--accent-text)]" : "text-[var(--alert-text)]",
            )}
          >
            {formatMoneyJOD(Math.abs(diff), currency, rates)}
          </div>
        </div>
      </div>

      {/* صفوف الدفعات */}
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div
            key={i}
            className="grid grid-cols-1 items-end gap-2 rounded-xl border border-[var(--line-soft)] bg-[var(--overlay-1)] p-3 sm:grid-cols-[28px_1fr_1fr_auto]"
          >
            <div className="num flex h-8 w-7 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[12px] font-black text-[var(--accent-text)]">
              {i + 1}
            </div>
            <Field label={t("المبلغ")}>
              <Input
                dir="ltr"
                className="num"
                type="number"
                min={0}
                step="0.01"
                value={r.amount}
                onChange={(e) => setRow(i, { amount: e.target.value })}
              />
            </Field>
            <Field label={t("تاريخ الاستحقاق")}>
              <Input
                type="date"
                value={r.dueDate}
                onChange={(e) => setRow(i, { dueDate: e.target.value })}
              />
            </Field>
            <button
              type="button"
              className="icon-btn danger"
              title="حذف الدفعة"
              onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <Btn
          size="sm"
          onClick={() =>
            setRows((rs) => [
              ...rs,
              { amount: "", dueDate: todayISO(30), note: "" },
            ])
          }
        >
          <Plus size={14} /> {t("إضافة دفعة")}
        </Btn>
      </div>

      {editable && saleId && (
        <Btn variant="primary" onClick={save} loading={saving} disabled={!valid}>
          <Wallet size={15} /> {t("حفظ خطة التقسيط")}
        </Btn>
      )}

      {/* الخطة المحفوظة على الفاتورة */}
      {existing.length > 0 && (
        <div className="space-y-1.5 border-t border-[var(--line-soft)] pt-3">
          <div className="text-[12px] font-extrabold">{t("الخطة المحفوظة")}</div>
          {existing.map((ins) => (
            <div
              key={ins.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--line-soft)] bg-[var(--overlay-1)] px-3 py-2"
            >
              <div className="min-w-0 text-[12px] font-bold">
                <span className="num">دفعة {ins.seq}</span> ·{" "}
                <span className="num">
                  {formatMoneyJOD(ins.amount, currency, rates)}
                </span>{" "}
                ·{" "}
                <span className="num text-[var(--faint)]">
                  {new Date(ins.dueDate).toLocaleDateString("ar-EG-u-nu-latn")}
                </span>
              </div>
              <button
                type="button"
                onClick={() => togglePaid(ins)}
                className={cls("btn btn-xs", ins.status === "paid" && "btn-primary")}
              >
                {ins.status === "paid" ? `✓ ${t("مسدّدة")}` : t("تعليم كمسدّدة")}
              </button>
            </div>
          ))}
        </div>
      )}

      {owed <= 0 && existing.length === 0 && (
        <p className="text-[12px] font-semibold text-[var(--faint)]">
          لا يوجد مبلغ متبقي لتقسيطه على هذه الفاتورة.
        </p>
      )}
    </div>
  );
}
