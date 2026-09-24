"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ArrowRight, Ban, Droplets, Printer, Trash2, Undo2 } from "lucide-react";
import { api } from "@/lib/client";
import { useToast } from "@/components/toast";
import { Badge, Btn, ConfirmDialog, Field, Input, Modal, Select, Skeleton } from "@/components/ui";
import { ProductImage } from "@/components/ProductImage";
import CurrencySwitcher from "@/components/CurrencySwitcher";
import { useCurrency } from "@/components/useCurrency";
import { formatMoneyJOD, isCurrencyCode, type CurrencyCode } from "@/lib/currency";
import {
  CLIENT_TYPES,
  PAYMENT_METHODS,
  SHIPPING_TYPES,
  cls,
  fmtDateTime,
  invoiceNo,
  type PaymentMethod,
  type ProductDTO,
  type SaleDetailDTO,
  type SessionUserDTO,
} from "@/lib/shared";

export default function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const toast = useToast();
  const { currency, settings, rates } = useCurrency();
  const [sale, setSale] = useState<SaleDetailDTO | null>(null);
  const [me, setMe] = useState<SessionUserDTO | null>(null);
  const [error, setError] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // مرتجع / استبدال
  const [retOpen, setRetOpen] = useState(false);
  const [retQty, setRetQty] = useState<Record<number, number>>({});
  const [exch, setExch] = useState<Array<{ productId: number; quantity: number; name: string }>>([]);
  const [exchPick, setExchPick] = useState("");
  const [exchCount, setExchCount] = useState("1");
  const [retNote, setRetNote] = useState("");
  const [retMethod, setRetMethod] = useState<PaymentMethod>("cash");
  const [retLoading, setRetLoading] = useState(false);
  const [catalog, setCatalog] = useState<ProductDTO[]>([]);

  async function load() {
    try {
      setSale(await api<SaleDetailDTO>(`/api/sales/${id}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل الفاتورة");
    }
  }

  useEffect(() => {
    api<SessionUserDTO>("/api/auth/me").then(setMe).catch(() => {});
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function doCancel() {
    if (cancelling) return;
    setCancelling(true);
    try {
      await api(`/api/sales/${id}`, { method: "PATCH", body: { action: "cancel" } });
      toast.push("ok", "تم إلغاء الفاتورة واسترجاع الكميات للمخزون");
      setCancelOpen(false);
      await load();
    } catch (e) {
      toast.push("err", e instanceof Error ? e.message : "تعذر الإلغاء");
    } finally {
      setCancelling(false);
    }
  }

  // طباعة حرارية على ورق 80mm — يُخفي الفاتورة الكاملة ويعرض الإيصال المختصر.
  function printThermal() {
    const style = document.createElement("style");
    style.id = "thermal-page-style";
    style.textContent = "@page { size: 80mm auto; margin: 4mm; }";
    document.head.appendChild(style);
    document.body.classList.add("print-thermal");
    const done = () => {
      document.body.classList.remove("print-thermal");
      style.remove();
      window.removeEventListener("afterprint", done);
    };
    window.addEventListener("afterprint", done);
    window.print();
    // بعض المتصفحات لا تطلق afterprint عند الإلغاء مباشرة.
    setTimeout(done, 1500);
  }

  function openReturn() {
    setRetQty({});
    setExch([]);
    setExchPick("");
    setExchCount("1");
    setRetNote("");
    setRetMethod(sale?.paymentMethod === "credit" ? "cash" : sale?.paymentMethod ?? "cash");
    setRetOpen(true);
    api<ProductDTO[]>("/api/products").then(setCatalog).catch(() => {});
  }

  async function submitReturn() {
    if (retLoading || !sale) return;
    const returned = sale.items
      .map((it) => ({ productId: it.productId, quantity: retQty[it.productId] ?? 0 }))
      .filter((l) => l.quantity > 0);
    const exchange = exch.map((l) => ({ productId: l.productId, quantity: l.quantity }));
    if (!returned.length && !exchange.length) {
      toast.push("info", "حدد كميات للإرجاع أو أضف أصناف استبدال");
      return;
    }
    setRetLoading(true);
    try {
      await api("/api/returns", {
        method: "POST",
        body: {
          saleId: sale.id,
          returned,
          exchange,
          note: retNote,
          method: retMethod,
        },
      });
      toast.push("ok", "تم تسجيل المرتجع/الاستبدال وتحديث المخزون والحساب");
      setRetOpen(false);
      await load();
    } catch (e) {
      toast.push("err", e instanceof Error ? e.message : "تعذر تسجيل المرتجع");
    } finally {
      setRetLoading(false);
    }
  }

  if (error) {
    return (
      <div className="panel anim-in p-10 text-center">
        <p className="text-[15px] font-extrabold text-[var(--danger)]">{error}</p>
        <Link href="/sales" className="btn btn-ghost btn-sm mt-4">
          <ArrowRight size={14} /> العودة للفواتير
        </Link>
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12" />
        <Skeleton className="h-[560px]" />
      </div>
    );
  }

  const cancelled = sale.status === "cancelled";
  const units = sale.items.reduce((a, i) => a + i.quantity, 0);

  return (
    <div className="space-y-4">
      {/* action bar (screen only) */}
      <div data-chrome className="anim-in flex flex-wrap items-center justify-between gap-2.5">
        <Link href="/sales" className="btn btn-ghost btn-sm">
          <ArrowRight size={15} /> كل الفواتير
        </Link>
        <div className="flex items-center gap-2">
          {cancelled ? (
            <Badge tone="rose">فاتورة ملغاة — تم استرجاع الكميات</Badge>
          ) : (
            <Badge tone="mint">فاتورة مكتملة</Badge>
          )}
          <Badge tone="slate">{isCurrencyCode(sale.currency) ? (sale.currency as CurrencyCode) : currency} • سعر {sale.rate || 1}</Badge>
          <Badge tone={sale.paymentMethod === "credit" ? "rose" : "mint"}>
            {PAYMENT_METHODS[sale.paymentMethod]}
          </Badge>
          <span data-chrome>
            <CurrencySwitcher defaultCurrency={settings?.defaultCurrency} compact />
          </span>
          <Btn variant="primary" size="sm" onClick={printThermal}>
            <Printer size={15} /> طباعة حرارية (80mm)
          </Btn>
          {me?.role === "admin" && !cancelled && (
            <Btn size="sm" onClick={openReturn}>
              <Undo2 size={15} /> مرتجع / استبدال
            </Btn>
          )}
          <Btn variant="primary" size="sm" onClick={() => window.print()}>
            <Printer size={15} /> طباعة / حفظ PDF
          </Btn>
          {me?.role === "admin" && !cancelled && (
            <Btn variant="danger" size="sm" onClick={() => setCancelOpen(true)}>
              <Ban size={15} /> إلغاء الفاتورة
            </Btn>
          )}
        </div>
      </div>

      {/* paper */}
      <div className="anim-in anim-d1 overflow-x-auto">
        <div className="invoice-paper relative mx-auto min-w-[680px] max-w-[860px] p-8 sm:p-11">
          {cancelled && (
            <div
              className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
            >
              <span
                className="rounded-2xl border-4 border-rose-500/60 px-10 py-3 text-[42px] font-black text-rose-500/60"
                style={{ transform: "rotate(-14deg)" }}
              >
                ملغاة
              </span>
            </div>
          )}

          {/* header */}
          <div className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-[#dce8e3] pb-6">
            <div className="flex items-center gap-3.5">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-2xl"
                style={{ background: "linear-gradient(135deg,#ff2222,#8f0000)" }}
              >
                <Droplets size={28} className="text-white" strokeWidth={2.5} />
              </div>
              <div>
                <div className="text-[22px] font-black tracking-tight text-[#0f1c26]">Cloud Culture</div>
                <div className="text-[11.5px] font-bold text-[#5c6b77]">
                  لتجارة المنتجات والتدخين الإلكتروني
                </div>
              </div>
            </div>
            <div className="text-end">
              <div className="text-[26px] font-black tracking-tight text-[#0f1c26]">فاتورة مبيعات</div>
              <div className="num text-[13px] font-extrabold text-[#c40000]">{invoiceNo(sale.id)}</div>
              <div className="mt-1 text-[11.5px] font-bold text-[#5c6b77]">
                {fmtDateTime(sale.createdAt)}
              </div>
            </div>
          </div>

          {/* parties */}
          <div className="grid grid-cols-1 gap-4 py-6 sm:grid-cols-2">
            <div className="rounded-2xl bg-[#f4f8f6] p-5">
              <div className="mb-1.5 text-[11px] font-black tracking-wide text-[#5c6b77]">فاتورة إلى</div>
              <div className="flex flex-wrap items-center gap-2 text-[15px] font-black text-[#0f1c26]">
                {sale.client.name}
                <span className="rounded-full bg-[#c40000]/10 px-2.5 py-0.5 text-[11px] font-extrabold text-[#c40000]">
                  {CLIENT_TYPES[sale.client.type]}
                </span>
              </div>
              <div className="mt-1.5 space-y-0.5 text-[12px] font-bold text-[#5c6b77]">
                {sale.client.phone && <div className="num">هاتف: {sale.client.phone}</div>}
                {sale.client.address && <div>العنوان: {sale.client.address}</div>}
              </div>
            </div>
            <div className="rounded-2xl bg-[#f4f8f6] p-5">
              <div className="mb-1.5 text-[11px] font-black tracking-wide text-[#5c6b77]">تفاصيل البيع</div>
              <div className="space-y-1 text-[12.5px] font-bold text-[#33424e]">
                <div>
                  البائع: <span className="font-black">{sale.seller.name}</span>
                  <span className="num text-[#8a97a3]"> @{sale.seller.username}</span>
                </div>
                <div>
                  الشحن: <span className="font-black">{SHIPPING_TYPES[sale.shippingType]}</span>
                </div>
                <div>
                  إجمالي القطع: <span className="num font-black">{units}</span>
                </div>
                <div>
                  طريقة الدفع:{" "}
                  <span className="font-black">{PAYMENT_METHODS[sale.paymentMethod]}</span>
                </div>
              </div>
            </div>
          </div>

          {/* items */}
          <table className="inv-table">
            <thead>
              <tr>
                <th style={{ width: "42%" }}>الصنف</th>
                <th>السعر</th>
                <th>الكمية</th>
                <th style={{ textAlign: "left" }}>الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((it) => (
                <tr key={it.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <span style={{ filter: "none" }}>
                        <ProductImage src={it.imageUrl} name={it.productName} size={44} radius={10} />
                      </span>
                      <span className="font-extrabold text-[#14222c]">{it.productName}</span>
                    </div>
                  </td>
                  <td>
                    <span className="num font-bold text-[#33424e]">{formatMoneyJOD(it.price, currency, rates)}</span>
                  </td>
                  <td>
                    <span className="num font-black text-[#14222c]">×{it.quantity}</span>
                  </td>
                  <td style={{ textAlign: "left" }}>
                    <span className="num font-black text-[#c40000]">{formatMoneyJOD(it.lineTotal, currency, rates)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* totals */}
          <div className="mt-6 flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-[340px] text-[11.5px] font-semibold leading-6 text-[#5c6b77]">
              {sale.notes ? (
                <>
                  <span className="font-black text-[#33424e]">ملاحظات: </span>
                  {sale.notes}
                </>
              ) : (
                "شكرًا لتعاملكم معنا — المنتجات المباعة لا تُرد إلا بموجب سياسة الاستبدال خلال 24 ساعة بحالتها الأصلية."
              )}
            </div>
            <div className="w-full max-w-[300px] space-y-1.5 text-[13px] font-bold text-[#33424e]">
              <div className="flex justify-between">
                <span>الإجمالي الفرعي ({currency})</span>
                <span className="num">{formatMoneyJOD(sale.subtotal, currency, rates)}</span>
              </div>
              <div className="flex justify-between">
                <span>الشحن ({SHIPPING_TYPES[sale.shippingType]})</span>
                <span className="num">{formatMoneyJOD(sale.shippingCost, currency, rates)}</span>
              </div>
              {sale.discount > 0 && (
                <div className="flex justify-between text-[var(--danger)]">
                  <span>الخصم</span>
                  <span className="num">− {formatMoneyJOD(sale.discount, currency, rates)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>المدفوع</span>
                <span className="num">{formatMoneyJOD(sale.paid, currency, rates)}</span>
              </div>
              {sale.remaining > 0 && (
                <div className="flex justify-between font-black text-[var(--danger)]">
                  <span>المتبقي (دين)</span>
                  <span className="num">{formatMoneyJOD(sale.remaining, currency, rates)}</span>
                </div>
              )}
              <div
                className="flex items-center justify-between rounded-2xl px-4 py-3 text-[15px] font-black text-white"
                style={{ background: "linear-gradient(135deg,#c40000,#5c0000)" }}
              >
                <span>الإجمالي المستحق ({currency})</span>
                <span className="num text-[19px]">{formatMoneyJOD(sale.total, currency, rates)}</span>
              </div>
            </div>
          </div>

          {/* footer */}
          <div className="mt-8 flex items-center justify-between border-t border-[#eaeff2] pt-4 text-[10.5px] font-bold text-[#8a97a3]">
            <span>أُنشئت إلكترونيًا بواسطة نظام Cloud Culture لإدارة المبيعات والمخزون</span>
            <span className="num">{invoiceNo(sale.id)}</span>
          </div>
        </div>
      </div>

      {/* إيصال حراري 80mm — يظهر فقط عند الطباعة الحرارية (body.print-thermal) */}
      <div
        className="thermal-receipt"
        dir="rtl"
        style={{
          fontFamily: "'Courier New', monospace",
          color: "#000",
          background: "#fff",
          width: "72mm",
          margin: "0 auto",
          padding: "4mm",
          fontSize: "12px",
          lineHeight: 1.7,
        }}
      >
        <div style={{ textAlign: "center", fontWeight: 800, fontSize: "16px" }}>Cloud Culture</div>
        <div style={{ textAlign: "center", fontSize: "11px" }}>لتجارة المنتجات والتدخين الإلكتروني</div>
        <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 700 }}>{invoiceNo(sale.id)}</span>
          <span>{fmtDateTime(sale.createdAt)}</span>
        </div>
        <div>العميل: {sale.client.name}</div>
        <div>البائع: {sale.seller.name}</div>
        <div>الدفع: {PAYMENT_METHODS[sale.paymentMethod]}</div>
        <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
        {sale.items.map((it) => (
          <div
            key={it.id}
            style={{ display: "flex", justifyContent: "space-between", gap: "4px" }}
          >
            <span style={{ flex: 1, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
              {it.productName}
            </span>
            <span>×{it.quantity}</span>
            <span style={{ fontWeight: 700 }}>{formatMoneyJOD(it.lineTotal, currency, rates)}</span>
          </div>
        ))}
        <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>الفرعي</span>
          <span>{formatMoneyJOD(sale.subtotal, currency, rates)}</span>
        </div>
        {sale.discount > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>الخصم</span>
            <span>- {formatMoneyJOD(sale.discount, currency, rates)}</span>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>الشحن</span>
          <span>{formatMoneyJOD(sale.shippingCost, currency, rates)}</span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontWeight: 800,
            fontSize: "14px",
            borderTop: "1px solid #000",
            marginTop: "4px",
            paddingTop: "4px",
          }}
        >
          <span>الإجمالي</span>
          <span>{formatMoneyJOD(sale.total, currency, rates)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>المدفوع</span>
          <span>{formatMoneyJOD(sale.paid, currency, rates)}</span>
        </div>
        {sale.remaining > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800 }}>
            <span>المتبقي</span>
            <span>{formatMoneyJOD(sale.remaining, currency, rates)}</span>
          </div>
        )}
        <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
        <div style={{ textAlign: "center", fontSize: "11px" }}>شكرًا لتعاملكم معنا — Cloud Culture</div>
      </div>

      {/* ===== مرتجع / استبدال ===== */}
      {sale && (
        <Modal
          open={retOpen}
          onClose={() => setRetOpen(false)}
          title={`مرتجع / استبدال — ${invoiceNo(sale.id)}`}
          icon={<Undo2 size={17} />}
          wide
        >
          <div className="space-y-4">
            <div>
              <p className="lbl">أصناف الفاتورة — حدد كمية الإرجاع (تعود للمخزون)</p>
              <ul className="max-h-[220px] space-y-2 overflow-y-auto pe-1">
                {sale.items.map((it) => {
                  const already = sale.returnedQty?.[it.productId] ?? 0;
                  const allowed = it.quantity - already;
                  return (
                    <li
                      key={it.id}
                      className="flex items-center gap-2 rounded-xl border border-[var(--line-soft)] bg-white/[.02] px-3 py-2"
                    >
                      <span className="min-w-0 flex-1 truncate text-[12.5px] font-extrabold">
                        {it.productName}
                      </span>
                      <span className="num shrink-0 text-[11px] font-bold text-[var(--faint)]">
                        بيع {it.quantity} • مرتجع {already}
                      </span>
                      <Input
                        type="number"
                        min={0}
                        max={allowed}
                        className="num !w-20 shrink-0"
                        value={retQty[it.productId] ?? ""}
                        placeholder="0"
                        disabled={allowed <= 0}
                        onChange={(e) =>
                          setRetQty((q) => ({
                            ...q,
                            [it.productId]: Math.max(
                              0,
                              Math.min(allowed, Math.trunc(Number(e.target.value) || 0)),
                            ),
                          }))
                        }
                      />
                    </li>
                  );
                })}
              </ul>
            </div>

            <div>
              <p className="lbl">أصناف الاستبدال (تُخصم من المخزون)</p>
              <div className="flex gap-2">
                <Select
                  value={exchPick}
                  onChange={(e) => setExchPick(e.target.value)}
                  className="min-w-0 flex-1"
                >
                  <option value="">— اختر صنفًا —</option>
                  {catalog
                    .filter((p) => p.stock > 0)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (متاح {p.stock})
                      </option>
                    ))}
                </Select>
                <Input
                  type="number"
                  min="1"
                  className="num !w-20"
                  value={exchCount}
                  onChange={(e) => setExchCount(e.target.value)}
                />
                <Btn
                  size="sm"
                  onClick={() => {
                    const p = catalog.find((x) => x.id === Number(exchPick));
                    if (!p) return;
                    const qty = Math.max(1, Math.trunc(Number(exchCount) || 1));
                    if (qty > p.stock) {
                      toast.push("info", `المتاح من "${p.name}" هو ${p.stock} فقط`);
                      return;
                    }
                    setExch((xs) => [...xs, { productId: p.id, quantity: qty, name: p.name }]);
                    setExchPick("");
                    setExchCount("1");
                  }}
                  disabled={!exchPick}
                >
                  إضافة
                </Btn>
              </div>
              {exch.length > 0 && (
                <ul className="mt-2 space-y-1.5">
                  {exch.map((l, i) => (
                    <li
                      key={`${l.productId}-${i}`}
                      className="flex items-center gap-2 rounded-lg border border-[var(--line-soft)] px-2.5 py-1.5 text-[12px] font-bold"
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {l.name} <span className="num">×{l.quantity}</span>
                      </span>
                      <button
                        className="icon-btn !h-6 !w-6"
                        onClick={() => setExch((xs) => xs.filter((_, j) => j !== i))}
                        aria-label="حذف"
                      >
                        <Trash2 size={12} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <Field label="طريقة الاسترداد / فرق الاستبدال">
              <Select
                value={retMethod}
                onChange={(e) => setRetMethod(e.target.value as PaymentMethod)}
              >
                {(["cash", "clink_haitham", "clink_lahsan", "delivery"] as PaymentMethod[]).map(
                  (m) => (
                    <option key={m} value={m}>
                      {PAYMENT_METHODS[m]}
                    </option>
                  ),
                )}
              </Select>
            </Field>

            <Field label="ملاحظة (اختياري)">
              <Input
                value={retNote}
                onChange={(e) => setRetNote(e.target.value)}
                placeholder="سبب الإرجاع / ملاحظات…"
              />
            </Field>

            <p className="rounded-xl border border-[var(--line-soft)] bg-white/[.03] px-3 py-2 text-[11.5px] font-bold text-[var(--muted)]">
              فرق القيمة (مرتجع − استبدال) يُخصم أو يُضاف على حساب العميل تلقائيًا، وتُسجَّل كل
              حركة في سجل المخزون.
            </p>

            <div className="flex justify-end gap-2 border-t border-[var(--line-soft)] pt-4">
              <Btn onClick={() => setRetOpen(false)}>إلغاء</Btn>
              <Btn variant="primary" onClick={submitReturn} loading={retLoading}>
                تسجيل المرتجع
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={doCancel}
        loading={cancelling}
        title="إلغاء الفاتورة"
        message={`سيتم إلغاء الفاتورة ${invoiceNo(sale.id)} واسترجاع ${units} قطعة إلى المخزون تلقائيًا. ستبقى الفاتورة في السجلات بحالة "ملغاة" مع تسجيل من قام بالإلغاء.`}
        confirmText="إلغاء الفاتورة"
      />
    </div>
  );
}
