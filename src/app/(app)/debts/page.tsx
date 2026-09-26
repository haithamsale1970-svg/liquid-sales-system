"use client";

// إدارة ديون العملاء (الذمم) وسجل الحركات:
// - قائمة العملاء المدينين مع المتبقي وعدد الفواتير المفتوحة.
// - تفاصيل كل عميل: الفواتير غير المسدّدة + سجل كل دفعة (الطريقة، المنفّذ، التاريخ).
// - تسديد دفعة (FIFO على أقدم الفواتير) مع تسجيل الحركة في سجل النشاط.
// - تصدير Excel للمطابقة المالية.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Banknote,
  Coins,
  Download,
  HandCoins,
  ReceiptText,
  RefreshCw,
  Search,
  Users,
  Wallet,
} from "lucide-react";
import { api, downloadXlsx } from "@/lib/client";
import { useToast } from "@/components/toast";
import {
  Badge,
  Btn,
  Card,
  Empty,
  Field,
  Input,
  Modal,
  Select,
  Skeleton,
} from "@/components/ui";
import CurrencySwitcher from "@/components/CurrencySwitcher";
import { useCurrency } from "@/components/useCurrency";
import { formatMoneyJOD } from "@/lib/currency";
import {
  CLIENT_TYPES,
  PAYMENT_METHODS,
  cls,
  fmtDate,
  fmtDateTime,
  fmtNum,
  invoiceNo,
  relTime,
  type DebtClientDTO,
  type DebtPaymentDTO,
  type DebtSaleDTO,
  type PaymentMethod,
} from "@/lib/shared";

type Detail = {
  client: { id: number; name: string; type: keyof typeof CLIENT_TYPES; phone: string };
  balance: number;
  unpaidSales: DebtSaleDTO[];
  payments: DebtPaymentDTO[];
};

const METHOD_TONES: Record<string, string> = {
  cash: "mint",
  clink_haitham: "sky",
  clink_lahsan: "violet",
  delivery: "amber",
  credit: "rose",
};

export default function DebtsPage() {
  const toast = useToast();
  const { currency, settings, rates } = useCurrency();
  const [rows, setRows] = useState<DebtClientDTO[] | null>(null);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [note, setNote] = useState("");
  const [paying, setPaying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await api<DebtClientDTO[]>("/api/debts"));
    } catch (e) {
      toast.push("err", e instanceof Error ? e.message : "تعذر تحميل الديون");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return rows ?? [];
    return (rows ?? []).filter((r) =>
      `${r.name} ${r.phone}`.toLowerCase().includes(n),
    );
  }, [rows, q]);

  const totals = useMemo(() => {
    const list = rows ?? [];
    const total = list.reduce((a, r) => a + r.debt, 0);
    const oldest = list.reduce<number | null>((acc, r) => {
      if (!r.lastSaleAt) return acc;
      const t = new Date(r.lastSaleAt).getTime();
      return acc === null || t < acc ? t : acc;
    }, null);
    return {
      total,
      clients: list.length,
      avg: list.length ? total / list.length : 0,
      max: list.reduce((a, r) => Math.max(a, r.debt), 0),
      oldest,
    };
  }, [rows]);

  async function openDetail(id: number) {
    setDetailId(id);
    setDetail(null);
    setAmount("");
    setNote("");
    setMethod("cash");
    setDetailLoading(true);
    try {
      setDetail(await api<Detail>(`/api/debts/${id}`));
    } catch (e) {
      toast.push("err", e instanceof Error ? e.message : "تعذر تحميل التفاصيل");
      setDetailId(null);
    } finally {
      setDetailLoading(false);
    }
  }

  async function refreshDetail(id: number) {
    try {
      setDetail(await api<Detail>(`/api/debts/${id}`));
    } catch {
      /* تجاهل */
    }
  }

  async function submitPayment() {
    if (!detailId || paying) return;
    const value = Math.round((Number(amount) || 0) * 1000) / 1000;
    if (!(value > 0)) {
      toast.push("info", "أدخل مبلغ التسديد أولاً");
      return;
    }
    setPaying(true);
    try {
      const r = await api<{ applied: number; fullyPaid: boolean; remainingAfter: number }>(
        `/api/debts/${detailId}`,
        { method: "POST", body: { amount: value, method, note } },
      );
      toast.push(
        "ok",
        r.fullyPaid
          ? `تم سداد الدين بالكامل (${r.applied.toFixed(2)}) — تم تصفير رصيد العميل`
          : `تم تحصيل ${r.applied.toFixed(2)} — المتبقي ${r.remainingAfter.toFixed(2)}`,
      );
      setAmount("");
      setNote("");
      await Promise.all([load(), refreshDetail(detailId)]);
    } catch (e) {
      toast.push("err", e instanceof Error ? e.message : "تعذر تسجيل التسديد");
    } finally {
      setPaying(false);
    }
  }

  function exportExcel() {
    const list = filtered;
    const sheets = [
      {
        name: "الديون",
        rows: [
          ["الفترة", new Date().toISOString().slice(0, 10)],
          ["إجمالي الديون", totals.total.toFixed(2)],
          ["عدد العملاء المدينين", totals.clients],
          [],
          [
            "العميل",
            "النوع",
            "الهاتف",
            "فواتير مفتوحة",
            "المتبقي (دين)",
            "آخر فاتورة",
          ],
          ...list.map((r) => [
            r.name,
            CLIENT_TYPES[r.type],
            r.phone || "",
            r.openSales,
            r.debt.toFixed(2),
            r.lastSaleAt ? r.lastSaleAt.slice(0, 10) : "",
          ]),
          [],
          ["الإجمالي", "", "", "", totals.total.toFixed(2), ""],
        ],
      },
      {
        name: "تفصيل الفواتير المفتوحة",
        rows: [
          ["العميل", "رقم الفاتورة", "التاريخ", "الإجمالي", "المدفوع", "المتبقي", "طريقة الدفع"],
          ...(detail
            ? detail.unpaidSales.map((s) => [
                detail.client.name,
                invoiceNo(s.id),
                s.createdAt.slice(0, 10),
                s.total.toFixed(2),
                s.paid.toFixed(2),
                s.remaining.toFixed(2),
                PAYMENT_METHODS[s.paymentMethod],
              ])
            : []),
        ],
      },
      {
        name: "سجل التحصيل",
        rows: [
          ["العميل", "المبلغ", "طريقة الدفع", "المنفّذ", "التاريخ", "ملاحظة"],
          ...(detail
            ? detail.payments.map((p) => [
                detail.client.name,
                p.amount.toFixed(2),
                PAYMENT_METHODS[p.method as PaymentMethod] ?? p.method,
                p.userName,
                p.createdAt.slice(0, 19).replace("T", " "),
                p.note,
              ])
            : []),
        ],
      },
    ];
    downloadXlsx(`الديون-${new Date().toISOString().slice(0, 10)}`, sheets);
    toast.push("ok", "تم تنزيل ملف Excel لإدارة الديون");
  }

  return (
    <div className="space-y-5">
      {/* ===== ملخص الديون ===== */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          icon={<Coins size={17} className="text-[var(--danger)]" />}
          tone="danger"
          label={`إجمالي الديون (${currency})`}
          value={formatMoneyJOD(totals.total, currency, rates)}
        />
        <Stat
          icon={<Users size={17} className="text-[var(--violet)]" />}
          tone="violet"
          label="عملاء مدينون"
          value={fmtNum(totals.clients)}
        />
        <Stat
          icon={<Banknote size={17} className="text-[var(--mint)]" />}
          tone="mint"
          label={`أعلى دين (${currency})`}
          value={formatMoneyJOD(totals.max, currency, rates)}
        />
        <Stat
          icon={<Wallet size={17} className="text-[var(--amber)]" />}
          tone="amber"
          label="أقدم رصيد مفتوح"
          value={totals.oldest ? fmtDate(totals.oldest) : "—"}
        />
      </div>

      {/* ===== أدوات ===== */}
      <div className="anim-in flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[220px] flex-1">
          <input
            className="inp ps-10"
            placeholder="ابحث باسم العميل أو هاتفه…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Search
            size={16}
            className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-[var(--faint)]"
          />
        </div>
        <CurrencySwitcher defaultCurrency={settings?.defaultCurrency} compact />
        <Btn variant="primary" size="sm" onClick={exportExcel} disabled={!filtered.length}>
          <Download size={14} /> تصدير Excel
        </Btn>
        <Btn size="sm" onClick={load} loading={loading}>
          <RefreshCw size={14} /> تحديث
        </Btn>
      </div>

      {/* ===== جدول الديون ===== */}
      <Card
        className="anim-in anim-d1 overflow-hidden"
        title="العملاء المدينون (الذمم)"
        icon={<Wallet size={16} />}
        bodyClass="overflow-x-auto"
      >
        {!rows ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Empty
            icon={<HandCoins size={22} />}
            title={q ? "لا نتائج مطابقة" : "لا توجد ديون حالياً"}
            hint={
              q
                ? "جرّب اسمًا أو رقم هاتف آخر"
                : "كل فواتير العملاء مسددة بالكامل — عمل ممتاز"
            }
          />
        ) : (
          <table className="tbl min-w-[760px]">
            <thead>
              <tr>
                <th>العميل</th>
                <th>النوع</th>
                <th>الهاتف</th>
                <th>فواتير مفتوحة</th>
                <th>المتبقي (دين)</th>
                <th>آخر فاتورة</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.clientId}>
                  <td>
                    <button
                      className="font-extrabold hover:text-[var(--mint)]"
                      onClick={() => openDetail(r.clientId)}
                    >
                      {r.name}
                    </button>
                  </td>
                  <td>
                    <Badge tone={r.type === "store" ? "mint" : r.type === "company" ? "violet" : "sky"}>
                      {CLIENT_TYPES[r.type]}
                    </Badge>
                  </td>
                  <td>
                    <span className="num text-[12.5px] font-bold text-[var(--muted)]" dir="ltr">
                      {r.phone || "—"}
                    </span>
                  </td>
                  <td>
                    <span className="num font-black">{fmtNum(r.openSales)}</span>
                  </td>
                  <td>
                    <span className="num font-black text-[var(--danger)]">
                      {formatMoneyJOD(r.debt, currency, rates)}
                    </span>
                  </td>
                  <td>
                    <span className="text-[12px] font-bold text-[var(--faint)]">
                      {r.lastSaleAt ? relTime(r.lastSaleAt) : "—"}
                    </span>
                  </td>
                  <td>
                    <div className="flex justify-end">
                      <Btn size="xs" variant="primary" onClick={() => openDetail(r.clientId)}>
                        <HandCoins size={13} /> تحصيل
                      </Btn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} className="font-extrabold">
                  الإجمالي
                </td>
                <td className="num font-black text-[var(--danger)]">
                  {formatMoneyJOD(filtered.reduce((a, r) => a + r.debt, 0), currency, rates)}
                </td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        )}
      </Card>

      {/* ===== نافذة تفاصيل الذمة + التحصيل ===== */}
      <Modal
        open={!!detailId}
        onClose={() => setDetailId(null)}
        title={detail ? `ذمة العميل — ${detail.client.name}` : "تفاصيل الذمة"}
        icon={<HandCoins size={17} />}
        wide
      >
        {detailLoading || !detail ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-11" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--line-soft)] bg-[var(--overlay-1)] p-3.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-extrabold">{detail.client.name}</span>
                  <Badge tone="sky">{CLIENT_TYPES[detail.client.type]}</Badge>
                </div>
                <div className="num mt-0.5 text-[12px] font-bold text-[var(--faint)]" dir="ltr">
                  {detail.client.phone || "بدون هاتف"}
                </div>
              </div>
              <div className="text-end">
                <div className="text-[11px] font-bold text-[var(--faint)]">
                  إجمالي المتبقي
                </div>
                <div className="num text-[20px] font-black text-[var(--danger)]">
                  {formatMoneyJOD(detail.balance, currency, rates)}
                </div>
              </div>
            </div>

            {/* نموذج التحصيل */}
            <div className="space-y-3 rounded-2xl border border-[var(--line-soft)] bg-[var(--overlay-1)] p-3.5">
              <div className="flex items-center gap-2 text-[13px] font-extrabold">
                <HandCoins size={15} className="text-[var(--mint)]" /> تسجيل تحصيل دفعة
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label={`المبلغ (${currency})`}>
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
                <Field label="طريقة الدفع">
                  <Select
                    value={method}
                    onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                  >
                    {(Object.keys(PAYMENT_METHODS) as PaymentMethod[]).map((m) => (
                      <option key={m} value={m}>
                        {PAYMENT_METHODS[m]}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: "كامل الدين", value: detail.balance },
                  { label: "النصف", value: Math.round((detail.balance / 2) * 100) / 100 },
                  { label: "25", value: 25 },
                  { label: "50", value: 50 },
                ].map((b) => (
                  <button
                    key={b.label}
                    type="button"
                    className="rounded-lg border border-[var(--line-soft)] bg-[var(--overlay-1)] px-2.5 py-1 text-[11.5px] font-extrabold text-[var(--muted)] hover:bg-[var(--overlay-2)]"
                    onClick={() => setAmount(String(b.value))}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
              <Field label="ملاحظة (اختياري)">
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="رقم الحوالة / ملاحظة التحصيل…"
                />
              </Field>
              <Btn
                variant="primary"
                className="w-full"
                onClick={submitPayment}
                loading={paying}
                disabled={!(Number(amount) > 0)}
              >
                <HandCoins size={15} /> تسجيل التسديد وتحديث الذمة
              </Btn>
              <p className="text-[11px] font-semibold leading-5 text-[var(--faint)]">
                يُوزَّع المبلغ تلقائيًا على أقدم الفواتير غير المسدَّدة (FIFO)، ويُسجَّل
                التحصيل باسمك في سجل النشاط مع طريقة الدفع للمطابقة المالية.
              </p>
            </div>

            {/* الفواتير غير المسددة */}
            <div>
              <div className="mb-2 flex items-center gap-2 text-[13px] font-extrabold">
                <ReceiptText size={15} className="text-[var(--amber)]" />
                الفواتير غير المسدّدة
                <span className="num text-[11.5px] font-bold text-[var(--faint)]">
                  ({fmtNum(detail.unpaidSales.length)})
                </span>
              </div>
              {detail.unpaidSales.length === 0 ? (
                <p className="rounded-xl border border-[var(--line-soft)] bg-[var(--overlay-1)] px-3 py-2 text-[12px] font-bold text-[var(--faint)]">
                  لا فواتير مفتوحة — الذمة مصفّرة
                </p>
              ) : (
                <div className="max-h-[230px] overflow-y-auto rounded-2xl border border-[var(--line-soft)]">
                  <table className="tbl min-w-[520px]">
                    <thead>
                      <tr>
                        <th>الفاتورة</th>
                        <th>التاريخ</th>
                        <th>الإجمالي</th>
                        <th>المدفوع</th>
                        <th>المتبقي</th>
                        <th>الدفع</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.unpaidSales.map((s) => (
                        <tr key={s.id}>
                          <td className="num font-black">{invoiceNo(s.id)}</td>
                          <td className="text-[11.5px] font-bold text-[var(--faint)]">
                            {fmtDate(s.createdAt)}
                          </td>
                          <td className="num">{formatMoneyJOD(s.total, currency, rates)}</td>
                          <td className="num">{formatMoneyJOD(s.paid, currency, rates)}</td>
                          <td className="num font-black text-[var(--danger)]">
                            {formatMoneyJOD(s.remaining, currency, rates)}
                          </td>
                          <td>
                            <Badge tone={METHOD_TONES[s.paymentMethod] ?? "slate"}>
                              {PAYMENT_METHODS[s.paymentMethod]}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* سجل الدفعات */}
            <div>
              <div className="mb-2 flex items-center gap-2 text-[13px] font-extrabold">
                <Banknote size={15} className="text-[var(--mint)]" />
                سجل حركات التحصيل
                <span className="num text-[11.5px] font-bold text-[var(--faint)]">
                  ({fmtNum(detail.payments.length)})
                </span>
              </div>
              {detail.payments.length === 0 ? (
                <p className="rounded-xl border border-[var(--line-soft)] bg-[var(--overlay-1)] px-3 py-2 text-[12px] font-bold text-[var(--faint)]">
                  لا دفعات مسجّلة بعد
                </p>
              ) : (
                <ul className="max-h-[230px] space-y-1.5 overflow-y-auto pe-1">
                  {detail.payments.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center gap-2.5 rounded-xl border border-[var(--line-soft)] bg-[var(--overlay-1)] px-3 py-2"
                    >
                      <span className="num shrink-0 text-[13px] font-black text-[var(--mint)]">
                        {formatMoneyJOD(p.amount, currency, rates)}
                      </span>
                      <Badge tone={METHOD_TONES[p.method] ?? "slate"}>
                        {PAYMENT_METHODS[p.method as PaymentMethod] ?? p.method}
                      </Badge>
                      <span className="min-w-0 flex-1 truncate text-[11.5px] font-bold text-[var(--muted)]">
                        {p.note || "—"}
                      </span>
                      <span className="shrink-0 text-end text-[10.5px] font-bold text-[var(--faint)]">
                        {p.userName} • {fmtDateTime(p.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Modal>
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
  tone: "danger" | "mint" | "violet" | "amber";
}) {
  const bg: Record<string, string> = {
    danger: "rgba(255,43,43,.12)",
    mint: "rgba(255,34,34,.12)",
    violet: "rgba(255,255,255,.1)",
    amber: "rgba(255,122,122,.12)",
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
