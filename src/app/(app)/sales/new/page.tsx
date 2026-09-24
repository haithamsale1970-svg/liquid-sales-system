"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PriceType, ProductVariantDTO } from "@/lib/shared";
import {
  CheckCircle2,
  History,
  Minus,
  Percent,
  Plus,
  ReceiptText,
  ScanLine,
  Search,
  ShoppingCart,
  Trash2,
  Truck,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/client";
import { useToast } from "@/components/toast";
import { Badge, Btn, Card, Field, Input, Select, Skeleton, Textarea } from "@/components/ui";
import { ProductImage } from "@/components/ProductImage";
import ClientPicker from "@/components/ClientPicker";
import CurrencySwitcher from "@/components/CurrencySwitcher";
import { useCurrency } from "@/components/useCurrency";
import { formatMoneyJOD } from "@/lib/currency";
import {
  CLIENT_TYPES,
  PAYMENT_METHODS,
  SHIPPING_TYPES,
  availablePaymentMethods,
  cls,
  fmtDate,
  fmtNum,
  invoiceNo,
  relTime,
  type ClientDTO,
  type ClientHistoryDTO,
  type ClientType,
  type PaymentMethod,
  type ProductDTO,
  type SessionUserDTO,
  type ShippingType,
} from "@/lib/shared";

export default function NewSalePage() {
  const router = useRouter();
  const toast = useToast();
  const { currency, settings, rates } = useCurrency();
  const [me, setMe] = useState<SessionUserDTO | null>(null);

  const [products, setProducts] = useState<ProductDTO[] | null>(null);
  const [clients, setClients] = useState<ClientDTO[] | null>(null);
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<Record<string, { product: ProductDTO; variant: ProductVariantDTO | null; priceType: PriceType; qty: number }>>({});
  const [variantPicker, setVariantPicker] = useState<{
    product: ProductDTO;
    priceType: PriceType;
  } | null>(null);

  const [clientId, setClientId] = useState("");
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [newClient, setNewClient] = useState({
    name: "",
    type: "individual" as ClientType,
    phone: "",
    phone2: "",
  });
  const [addingClient, setAddingClient] = useState(false);

  // تاريخ العميل: يُجلب فور اختياره لعرض عدد طلباته ومفضّلاته وآخر فواتيره.
  const [history, setHistory] = useState<ClientHistoryDTO | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);

  const [shippingType, setShippingType] = useState<ShippingType>("none");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [paidInput, setPaidInput] = useState("");
  const [discountType, setDiscountType] = useState<"none" | "percent" | "amount">("none");
  const [discountValue, setDiscountValue] = useState("");
  const [scan, setScan] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api<ProductDTO[]>("/api/products")
      .then((ps) => setProducts(ps.filter((p) => !p.archived)))
      .catch((e) => toast.push("err", e.message));
    api<ClientDTO[]>("/api/clients")
      .then(setClients)
      .catch((e) => toast.push("err", e.message));
    api<SessionUserDTO>("/api/auth/me").then(setMe).catch(() => {});
    // ماسح الباركود جاهز للعمل مباشرة دون أي نقرة إضافية.
    window.setTimeout(() => scanRef.current?.focus(), 250);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!clientId) {
      setHistory(null);
      return;
    }
    let alive = true;
    setHistoryLoading(true);
    api<ClientHistoryDTO>(`/api/clients/${clientId}`)
      .then((h) => {
        if (alive) setHistory(h);
      })
      .catch(() => {
        if (alive) setHistory(null);
      })
      .finally(() => {
        if (alive) setHistoryLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [clientId]);

  const byId = useMemo(() => new Map((products ?? []).map((p) => [p.id, p])), [products]);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return (products ?? []).filter((p) => !n || `${p.name} ${p.category}`.toLowerCase().includes(n));
  }, [products, q]);

  const cartEntries = useMemo(() => Object.values(cart), [cart]);
  const subtotal = cartEntries.reduce(
    (a, x) => a + (x.variant ? (x.priceType === "wholesale" ? x.variant.wholesalePrice : x.variant.retailPrice) : x.product.price) * x.qty,
    0,
  );
  // المستخدم العادي محجوب عن الكلف/الأرباح — نحسب الربح للأدمن فقط للعرض.
  const isAdmin = me?.role === "admin";
  const canManageClients =
    isAdmin || (settings?.allowUsersEditClients === true && me?.canEditClients === true);
  const profit = isAdmin
    ? cartEntries.reduce(
        (a, x) =>
          a +
          ((x.variant ? (x.priceType === "wholesale" ? x.variant.wholesalePrice : x.variant.retailPrice) : x.product.price) -
            (x.variant ? x.variant.cost : x.product.cost)) *
            x.qty,
        0,
      )
    : 0;
  // التوصيل ثابت من إعدادات الأدمن (داخلي 1.5 / خارجي 2 افتراضيًا).
  const ship =
    shippingType === "none" ? 0 : shippingType === "internal" ? (settings?.shippingInternal ?? 1.5) : (settings?.shippingExternal ?? 2);
  // خصم الفاتورة (للأدمن فقط): نسبة أو مبلغ ثابت.
  const dv = Math.max(0, Number(discountValue) || 0);
  const discount = isAdmin
    ? discountType === "percent"
      ? Math.min(subtotal, (subtotal * Math.min(dv, 100)) / 100)
      : discountType === "amount"
        ? Math.min(subtotal + ship, dv)
        : 0
    : 0;
  const total = Math.max(0, Number((subtotal + ship - discount).toFixed(2)));
  const isDeliveryShipping = shippingType !== "none";
  // الموظف العادي لا يستطيع تفعيل الآجل حتى لو وصلت الحالة من طلب قديم،
  // و"مستحقات شركة التوصيل" لا تُحفظ إطلاقًا بدون توصيل فعلي.
  const effectivePaymentMethod: PaymentMethod = isDeliveryShipping
    ? "delivery"
    : paymentMethod === "delivery" || (!isAdmin && paymentMethod === "credit")
      ? "cash"
      : paymentMethod;
  const isDeliverySale = isDeliveryShipping && effectivePaymentMethod === "delivery";
  // الصافي بذمة شركة التوصيل = الإجمالي النهائي للطلب − قيمة التوصيل فقط (مثال: 89 − 1.5 = 87.5).
  const deliveryReceivable = isDeliverySale
    ? Math.max(0, Number((total - ship).toFixed(2)))
    : 0;
  // المدفوع الافتراضي: آجل = صفر، التوصيل = سعر التوصيل، وغيرها = كامل الإجمالي.
  const paid = isDeliverySale
    ? Math.min(total, ship)
    : effectivePaymentMethod === "credit"
      ? Math.min(Number(paidInput) || 0, total)
      : paidInput === ""
        ? total
        : Math.min(Number(paidInput) || 0, total);
  const remaining = isDeliverySale
    ? deliveryReceivable
    : Math.max(0, Number((total - paid).toFixed(2)));

  // ===== ماسح الباركود السريع (Keyboard Wedge) =====
  // القارئ يكتب الأرقام ثم Enter: نطابق الباركود أولًا، ثم الاسم النصي،
  // ونعيد التركيز للحقل فورًا حتى يبقى الماسح جاهزًا للقطعة التالية.
  function resolveScan(code: string): ProductDTO | undefined {
    const list = products ?? [];
    const exact = code.toLowerCase();
    return (
      list.find((p) => p.barcode && p.barcode.toLowerCase() === exact) ??
      list.find((p) => p.name.trim().toLowerCase() === exact)
    );
  }

  function handleScanKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const code = scan.trim();
    if (!code || !products) return;
    const hit = resolveScan(code);
    if (!hit) {
      toast.push("info", `لا يوجد صنف بهذا الباركود (${code}) — تحقق من الصنف أو أضفه`);
      setScan("");
      return;
    }
    if (hit.stock <= 0) {
      toast.push("err", `"${hit.name}" نفد من المخزون — لا يمكن إضافته`);
      setScan("");
      return;
    }
    const already = cartEntries
      .filter((x) => x.product.id === hit.id)
      .reduce((sum, x) => sum + x.qty, 0);
    if (already >= hit.stock) {
      toast.push("info", `"${hit.name}" — وصلت للكمية المتاحة (${hit.stock})`);
      setScan("");
      return;
    }
    if (hit.variants.length) {
      toggleVariantPicker(hit);
    } else {
      addToCart(hit);
      toast.push("ok", `تمت إضافة "${hit.name}" عبر الباركود`);
    }
    setScan("");
    scanRef.current?.focus();
  }

  function lineKey(p: ProductDTO, variant: ProductVariantDTO | null, priceType: PriceType) {
    return `${p.id}:${variant?.id ?? "base"}:${priceType}`;
  }

  function addToCart(p: ProductDTO, variant: ProductVariantDTO | null = null, priceType: PriceType = "retail") {
    const key = lineKey(p, variant, priceType);
    const available = variant ? variant.stock : p.stock;
    setCart((c) => {
      const current = c[key];
      const next = (current?.qty ?? 0) + 1;
      if (next > available) {
        toast.push("info", `"${p.name}" — المتاح ${available} فقط`);
        return c;
      }
      return { ...c, [key]: { product: p, variant, priceType, qty: next } };
    });
  }

  function toggleVariantPicker(p: ProductDTO) {
    // لا شيء يظهر افتراضيًا: الضغط على زر المنتج يفتح قائمة الخيارات المخزنة والمتاحة فقط.
    if (!p.variants.length) {
      addToCart(p);
      return;
    }
    const available = p.variants.filter((v) => v.stock > 0);
    if (available.length === 0) {
      toast.push("err", `"${p.name}" لا يحتوي على خيارات متاحة حالياً`);
      return;
    }
    setVariantPicker((cur) =>
      cur?.product.id === p.id
        ? null
        : { product: { ...p, variants: available }, priceType: "retail" },
    );
  }

  function setQty(key: string, qty: number) {
    setCart((c) => {
      const line = c[key];
      if (!line) return c;
      if (qty <= 0) {
        const { [key]: _drop, ...rest } = c;
        return rest;
      }
      const available = line.variant ? line.variant.stock : line.product.stock;
      return { ...c, [key]: { ...line, qty: Math.min(qty, available) } };
    });
  }

  function removeLine(key: string) {
    setCart((c) => {
      const { [key]: _drop, ...rest } = c;
      return rest;
    });
  }

  async function quickAddClient() {
    if (addingClient || newClient.name.trim().length < 2) return;
    setAddingClient(true);
    try {
      const r = await api<{ id: number }>("/api/clients", { method: "POST", body: newClient });
      toast.push("ok", `تمت إضافة العميل "${newClient.name}"`);
      const all = await api<ClientDTO[]>("/api/clients");
      setClients(all);
      setClientId(String(r.id));
      setAddClientOpen(false);
      setNewClient({ name: "", type: "individual", phone: "", phone2: "" });
    } catch (e) {
      toast.push("err", e instanceof Error ? e.message : "تعذر الإضافة");
    } finally {
      setAddingClient(false);
    }
  }

  async function submit() {
    if (submitting) return;
    if (!clientId) {
      toast.push("info", "اختر العميل أولاً");
      return;
    }
    if (!cartEntries.length) {
      toast.push("info", "أضف صنفًا واحدًا على الأقل");
      return;
    }
    setSubmitting(true);
    try {
      const r = await api<{ id: number }>("/api/sales", {
        method: "POST",
        body: {
          clientId: Number(clientId),
          items: cartEntries.map((x) => ({
            productId: x.product.id,
            variantId: x.variant?.id ?? null,
            priceType: x.priceType,
            quantity: x.qty,
          })),
          shippingType,
          currency,
          notes,
          paymentMethod: effectivePaymentMethod,
          paid,
          discountType,
          discountValue: dv,
        },
      });
      toast.push("ok", "تم إنشاء الفاتورة وخصم الكميات من المخزون");
      router.push(`/sales/${r.id}`);
    } catch (e) {
      toast.push("err", e instanceof Error ? e.message : "تعذر إنشاء الفاتورة");
      setSubmitting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
      {/* products picker */}
      <Card
        className="anim-in xl:col-span-3"
        title="اختيار الأصناف"
        icon={<ShoppingCart size={16} />}
        actions={
          <div className="relative w-52">
            <input
              className="inp !py-2 ps-9 !text-[13px]"
              placeholder="بحث…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <Search size={14} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
          </div>
        }
        bodyClass="p-4"
      >
        {/* ماسح الباركود */}
        <div className="relative mb-1.5">
          <input
            ref={scanRef}
            className="inp ps-9 !text-[13px]"
            placeholder="امسح الباركود ثم Enter…"
            value={scan}
            onChange={(e) => setScan(e.target.value)}
            onKeyDown={handleScanKey}
            autoFocus
            inputMode="numeric"
            dir="ltr"
          />
          <ScanLine size={15} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
        </div>
        <p className="mb-3 text-[11px] font-bold text-[var(--faint)]">
          الماسح جاهز تلقائيًا: كل مسح يضيف القطعة فورًا للفاتورة — وإن لم يُوجد الباركود
          سيظهر تنبيه بالرقم المقروء.
        </p>
        {!products ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[150px]" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-[13px] font-bold text-[var(--faint)]">
            لا توجد أصناف — أضف منتجات من صفحة الأصناف أولاً
          </p>
        ) : (
          <div className="grid max-h-[62vh] grid-cols-2 gap-3 overflow-y-auto pe-1 md:grid-cols-3">
            {filtered.map((p) => {
              const out = p.stock === 0;
              const low = !out && p.stock <= p.lowStockAt;
              const inCart = cartEntries
                .filter((x) => x.product.id === p.id)
                .reduce((sum, x) => sum + x.qty, 0);
              const expanded = variantPicker?.product.id === p.id;
              const options = expanded ? p.variants.filter((v) => v.stock > 0) : [];
              return (
                <div
                  key={p.id}
                  className={cls(
                    "flex flex-col",
                    expanded &&
                      "col-span-2 rounded-2xl border border-[rgba(255,34,34,.35)] bg-white/[.04] p-2 md:col-span-3",
                  )}
                >
                  <button
                    onClick={() => !out && toggleVariantPicker(p)}
                    disabled={out}
                    aria-expanded={expanded}
                    className={cls(
                      "group relative overflow-hidden rounded-2xl border text-start transition-all",
                      out
                        ? "cursor-not-allowed border-[var(--line-soft)] opacity-45"
                        : inCart > 0
                          ? "border-[rgba(255,34,34,.5)] bg-[rgba(255,34,34,.06)]"
                          : low
                            ? "border-[rgba(255,170,0,.45)] bg-[rgba(255,170,0,.06)] hover:bg-[rgba(255,170,0,.1)]"
                            : "border-[var(--line-soft)] bg-white/[.02] hover:border-[rgba(255,34,34,.35)] hover:bg-white/[.05]",
                    )}
                  >
                    <div className="flex items-start gap-2.5 p-3">
                      <ProductImage
                        src={p.imageUrl}
                        name={p.name}
                        size={46}
                        radius={12}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12.5px] font-extrabold leading-5">{p.name}</div>
                        <div className="num mt-0.5 text-[13px] font-black text-[var(--mint)]">{formatMoneyJOD(p.price, currency, rates)}</div>
                        <div className={cls("num mt-0.5 text-[10.5px] font-bold", out ? "text-[var(--danger)]" : low ? "text-amber-400" : "text-[var(--faint)]")}>
                          {out ? "نفد المخزون" : low ? `مخزون منخفض: ${p.stock}` : `متاح: ${p.stock}`}
                        </div>
                      </div>
                    </div>
                    {low && (
                      <span className="absolute end-2.5 top-2.5 rounded-md bg-[rgba(255,170,0,.16)] px-1.5 py-0.5 text-[9.5px] font-black text-amber-400">
                        حد التنبيه
                      </span>
                    )}
                    {inCart > 0 && (
                      <span className="absolute left-2.5 top-2.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--mint)] px-1 text-[12px] font-black text-[#04211a]">
                        <span className="num">{inCart}</span>
                      </span>
                    )}
                  </button>

                  {/* الخيارات المخزنة والمتاحة فقط — تنزل أسفل الزر بضغطة واحدة */}
                  {expanded && (
                    <div className="anim-in mt-2 border-t border-[var(--line-soft)] pt-2">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-extrabold text-[var(--muted)]">
                          الخيارات المتاحة — {p.name}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setVariantPicker((v) =>
                                v ? { ...v, priceType: "retail" } : v,
                              )
                            }
                            className={cls(
                              "rounded-lg border px-2 py-1 text-[10.5px] font-extrabold transition-colors",
                              variantPicker.priceType === "retail"
                                ? "border-[var(--mint)] bg-[rgba(255,34,34,.14)] text-[var(--mint)]"
                                : "border-[var(--line-soft)] text-[var(--faint)]",
                            )}
                          >
                            سعر الأفراد
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setVariantPicker((v) =>
                                v ? { ...v, priceType: "wholesale" } : v,
                              )
                            }
                            className={cls(
                              "rounded-lg border px-2 py-1 text-[10.5px] font-extrabold transition-colors",
                              variantPicker.priceType === "wholesale"
                                ? "border-[var(--mint)] bg-[rgba(255,34,34,.14)] text-[var(--mint)]"
                                : "border-[var(--line-soft)] text-[var(--faint)]",
                            )}
                          >
                            سعر الجملة
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                        {options.map((v) => {
                          const unit =
                            variantPicker.priceType === "wholesale"
                              ? v.wholesalePrice
                              : v.retailPrice;
                          return (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => {
                                addToCart(p, v, variantPicker.priceType);
                                setVariantPicker(null);
                              }}
                              className="flex items-center justify-between gap-2 rounded-xl border border-[var(--line-soft)] bg-white/[.03] px-3 py-2 text-start transition-colors hover:border-[rgba(255,34,34,.4)] hover:bg-white/[.07]"
                            >
                              <span className="num text-[12px] font-extrabold">
                                {v.size} — {v.nicotine}
                              </span>
                              <span className="flex shrink-0 items-center gap-2">
                                <span className="num text-[10.5px] font-bold text-[var(--faint)]">
                                  متاح {v.stock}
                                </span>
                                <span className="num text-[12px] font-black text-[var(--mint)]">
                                  {formatMoneyJOD(unit, currency, rates)}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* cart / invoice builder */}
      <div className="anim-in anim-d1 xl:col-span-2">
        <Card title="تفاصيل الفاتورة" icon={<ReceiptText size={16} />} bodyClass="flex flex-col gap-4 p-4">
          {/* client */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="lbl !mb-0">العميل *</label>
              {canManageClients && (
                <button className="link flex items-center gap-1 text-[11.5px]" onClick={() => setAddClientOpen((s) => !s)}>
                  <UserPlus size={13} /> عميل جديد
                </button>
              )}
            </div>
            <ClientPicker
              clients={clients ?? []}
              value={clientId}
              onChange={(id) => setClientId(id === null ? "" : String(id))}
              onQuickAdd={(name) => {
                setNewClient((n) => ({ ...n, name }));
                setAddClientOpen(true);
              }}
              canQuickAdd={canManageClients}
            />
            {addClientOpen && canManageClients && (
              <div className="mt-2 space-y-2 rounded-2xl border border-[var(--line-soft)] bg-white/[.03] p-3">
                <Input placeholder="اسم العميل" value={newClient.name} onChange={(e) => setNewClient((n) => ({ ...n, name: e.target.value }))} />
                <div className="flex gap-2">
                  <Select value={newClient.type} onChange={(e) => setNewClient((n) => ({ ...n, type: e.target.value as ClientType }))}>
                    <option value="store">محل</option>
                    <option value="company">شركة</option>
                    <option value="individual">فرد</option>
                  </Select>
                  <Input placeholder="الهاتف" dir="ltr" className="num" value={newClient.phone} onChange={(e) => setNewClient((n) => ({ ...n, phone: e.target.value }))} />
                </div>
                <Input
                  placeholder="رقم هاتف ثانٍ (اختياري)"
                  dir="ltr"
                  className="num"
                  value={newClient.phone2}
                  onChange={(e) => setNewClient((n) => ({ ...n, phone2: e.target.value }))}
                />
                <Btn size="sm" variant="primary" onClick={quickAddClient} loading={addingClient} disabled={newClient.name.trim().length < 2} className="w-full">
                  حفظ العميل واختياره
                </Btn>
              </div>
            )}

            {/* ===== تاريخ العميل: عدد مرات الطلب + المفضّلات + آخر الفواتير ===== */}
            {clientId && (
              <div className="mt-2.5 rounded-2xl border border-[var(--line-soft)] bg-white/[.02] p-3">
                {historyLoading ? (
                  <Skeleton className="h-10" />
                ) : !history ? (
                  <p className="text-[11.5px] font-bold text-[var(--faint)]">
                    تعذر تحميل تاريخ العميل — يمكنك متابعة الفاتورة عاديًا
                  </p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-2 text-[11.5px] font-bold text-[var(--muted)]">
                      <Badge tone="mint">
                        <History size={11} /> طلب <span className="num">{fmtNum(history.stats.orders)}</span> مرة
                      </Badge>
                      <span>
                        إجمالي مشترياته:{" "}
                        <span className="num text-[var(--mint)]">
                          {formatMoneyJOD(history.stats.total, currency, rates)}
                        </span>
                      </span>
                      <span>
                        متوسط الفاتورة:{" "}
                        <span className="num">
                          {formatMoneyJOD(history.stats.avg, currency, rates)}
                        </span>
                      </span>
                      {history.stats.debt > 0 && (
                        <Badge tone="rose">
                          دين قائم{" "}
                          <span className="num">
                            {formatMoneyJOD(history.stats.debt, currency, rates)}
                          </span>
                        </Badge>
                      )}
                      <span className="ms-auto text-[10.5px] font-bold text-[var(--faint)]">
                        {history.stats.lastOrderAt
                          ? `آخر طلب: ${relTime(history.stats.lastOrderAt)}`
                          : "لا فواتير سابقة لهذا العميل"}
                      </span>
                    </div>

                    {history.favorites.length > 0 && (
                      <div className="mt-2.5">
                        <div className="mb-1.5 text-[11px] font-extrabold text-[var(--faint)]">
                          أصنافه المفضّلة — اضغط صنفًا لإضافته فورًا:
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {history.favorites.map((f) => {
                            const p = byId.get(f.productId);
                            return (
                              <button
                                key={f.productId}
                                type="button"
                                disabled={!p || p.stock <= 0}
                                onClick={() => p && toggleVariantPicker(p)}
                                className={cls(
                                  "flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-bold transition-colors",
                                  !p || p.stock <= 0
                                    ? "cursor-not-allowed border-[var(--line-soft)] opacity-50"
                                    : "border-[var(--line-soft)] bg-white/[.03] hover:border-[rgba(255,34,34,.4)] hover:bg-white/[.06]",
                                )}
                              >
                                <ProductImage src={f.imageUrl} name={f.name} size={18} radius={5} />
                                {f.name}
                                <span className="num text-[var(--mint)]">×{fmtNum(f.qty)}</span>
                                {!p && <span className="text-[var(--danger)]">(محذوف)</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {history.purchases.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-extrabold text-[var(--faint)]">
                          آخر فواتيره:
                        </span>
                        {history.purchases.slice(0, 4).map((s) => (
                          <Link
                            key={s.id}
                            href={`/sales/${s.id}`}
                            className="num rounded-lg border border-[var(--line-soft)] bg-white/[.03] px-2 py-1 text-[11px] font-bold text-[var(--muted)] hover:bg-white/[.06]"
                          >
                            {invoiceNo(s.id)} • {fmtDate(s.createdAt)}
                          </Link>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* lines */}
          <div className="min-h-[120px]">
            {!isAdmin && (
              <p className="mb-2 rounded-xl border border-[var(--line-soft)] bg-white/[.03] px-3 py-2 text-[11.5px] font-bold text-[var(--muted)]">
                وضع الموظف — الأرباح والكلف مخفية، أسعار البيع والمخزون فقط
              </p>
            )}
            {cartEntries.length === 0 ? (
              <div className="flex h-[120px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--line)] text-[var(--faint)]">
                <ShoppingCart size={22} />
                <span className="text-[12px] font-bold">الفاتورة فارغة — اختر الأصناف من القائمة</span>
              </div>
            ) : (
              <ul className="max-h-[260px] space-y-2 overflow-y-auto pe-1">
                {cartEntries.map((line) => {
                  const { product: p, variant, priceType, qty } = line;
                  const unitPrice = variant
                    ? priceType === "wholesale"
                      ? variant.wholesalePrice
                      : variant.retailPrice
                    : p.price;
                  const available = variant ? variant.stock : p.stock;
                  const key = lineKey(p, variant, priceType);
                  return (
                   <li key={key} className="flex items-center gap-2.5 rounded-2xl border border-[var(--line-soft)] bg-white/[.02] p-2.5">
                     <ProductImage
                       src={p.imageUrl}
                       name={p.name}
                       size={40}
                       radius={10}
                     />
                     <div className="min-w-0 flex-1">
                       <div className="truncate text-[12.5px] font-extrabold">{p.name}</div>
                       {variant && (
                         <div className="text-[10.5px] font-bold text-[var(--faint)]">
                           {variant.size} • {variant.nicotine} • {priceType === "wholesale" ? "سعر الجملة" : "سعر الأفراد"}
                         </div>
                       )}
                       <div className="num text-[11px] font-bold text-[var(--muted)]">
                         {formatMoneyJOD(unitPrice, currency, rates)} × {qty} = <span className="text-[var(--mint)]">{formatMoneyJOD(unitPrice * qty, currency, rates)}</span>
                       </div>
                     </div>
                     <div className="flex items-center gap-1">
                       <button className="icon-btn !h-7 !w-7" onClick={() => setQty(key, qty - 1)}>
                         <Minus size={13} />
                       </button>
                       <span className="num w-7 text-center text-[13px] font-black">{qty}</span>
                       <button className="icon-btn !h-7 !w-7" onClick={() => setQty(key, qty + 1)} disabled={qty >= available}>
                         <Plus size={13} />
                       </button>
                       <button className="icon-btn danger !h-7 !w-7" onClick={() => removeLine(key)}>
                         <Trash2 size={13} />
                       </button>
                     </div>
                   </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* shipping */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="lbl !mb-0">التوصيل (ثابت من إعدادات الأدمن)</label>
              <CurrencySwitcher defaultCurrency={settings?.defaultCurrency} compact />
            </div>
            <div className="flex gap-2">
              {([
                { t: "none" as ShippingType, fee: 0 },
                { t: "internal" as ShippingType, fee: settings?.shippingInternal ?? 1.5 },
                { t: "external" as ShippingType, fee: settings?.shippingExternal ?? 2 },
              ]).map(({ t, fee }) => (
                <button
                  key={t}
                  onClick={() => {
                    setShippingType(t);
                    if (t !== "none") {
                      setPaymentMethod("delivery");
                      setPaidInput("");
                    } else if (paymentMethod === "delivery") {
                      setPaymentMethod("cash");
                      setPaidInput("");
                    }
                  }}
                  className={cls(
                    "flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl border px-2 py-2.5 text-[12px] font-extrabold transition-all",
                    shippingType === t
                      ? "border-[rgba(255,34,34,.55)] bg-[rgba(255,34,34,.1)] text-[var(--mint)]"
                      : "border-[var(--line-soft)] bg-white/[.02] text-[var(--muted)] hover:bg-white/[.05]",
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    <Truck size={13} />
                    {SHIPPING_TYPES[t]}
                  </span>
                  {t !== "none" && (
                    <span className="num text-[11px] font-black">{formatMoneyJOD(fee, currency, rates)}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* طريقة الدفع — "مستحقات شركة التوصيل" تظهر فقط مع توصيل فعلي */}
          <div>
            <label className="lbl">طريقة الدفع *</label>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {availablePaymentMethods(shippingType, isAdmin).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPaymentMethod(m)}
                  className={cls(
                    "rounded-xl border px-2 py-2 text-[11.5px] font-extrabold transition-all",
                    paymentMethod === m
                      ? "border-[rgba(255,34,34,.55)] bg-[rgba(255,34,34,.1)] text-[var(--mint)]"
                      : "border-[var(--line-soft)] bg-white/[.02] text-[var(--muted)] hover:bg-white/[.05]",
                  )}
                >
                  {PAYMENT_METHODS[m]}
                </button>
              ))}
            </div>
            {!isDeliveryShipping && (
              <p className="mt-2 text-[11px] font-semibold text-[var(--faint)]">
                "مستحقات شركة التوصيل" تظهر فقط عند اختيار توصيل داخلي أو خارجي.
              </p>
            )}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Field
                label={
                  isDeliverySale
                    ? `مبلغ شركة التوصيل (${currency})`
                    : `المدفوع (${currency})`
                }
              >
                <Input
                  type="number"
                  min="0"
                  step="any"
                  dir="ltr"
                  className="num"
                  value={isDeliverySale ? paid.toFixed(2) : paidInput}
                  onChange={(e) => {
                    if (!isDeliverySale) setPaidInput(e.target.value);
                  }}
                  placeholder={effectivePaymentMethod === "credit" ? "0 — آجل" : total.toFixed(2)}
                  disabled={isDeliverySale}
                />
              </Field>
              {remaining > 0 && (
                <div className="flex flex-col justify-end pb-1">
                  <span className="text-[11px] font-bold text-[var(--faint)]">المتبقي على العميل</span>
                  <span className="num text-[15px] font-black text-[var(--danger)]">
                    {formatMoneyJOD(remaining, currency, rates)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* خصم الفاتورة (للأدمن فقط) */}
          {isAdmin && (
            <div>
              <label className="lbl">الخصم على الفاتورة</label>
              <div className="flex gap-2">
                <Select
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as typeof discountType)}
                >
                  <option value="none">بدون خصم</option>
                  <option value="percent">نسبة %</option>
                  <option value="amount">مبلغ ثابت</option>
                </Select>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  dir="ltr"
                  className="num !w-28"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder="0"
                  disabled={discountType === "none"}
                />
              </div>
            </div>
          )}

          <Field label="ملاحظات الفاتورة">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="اختياري — تظهر أسفل الفاتورة" />
          </Field>

          {/* totals */}
          <div className="space-y-2 rounded-2xl border border-[var(--line-soft)] bg-white/[.03] p-4">
            <div className="flex justify-between text-[13px] font-bold text-[var(--muted)]">
              <span>الإجمالي الفرعي ({currency})</span>
              <span className="num">{formatMoneyJOD(subtotal, currency, rates)}</span>
            </div>
            <div className="flex justify-between text-[13px] font-bold text-[var(--muted)]">
              <span>التوصيل ({SHIPPING_TYPES[shippingType]})</span>
              <span className="num">{formatMoneyJOD(ship, currency, rates)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-[13px] font-bold text-[var(--danger)]">
                <span>الخصم {discountType === "percent" ? `(${dv}%)` : ""}</span>
                <span className="num">− {formatMoneyJOD(discount, currency, rates)}</span>
              </div>
            )}
            <div className="flex justify-between text-[13px] font-bold text-[var(--muted)]">
              <span>المدفوع ({PAYMENT_METHODS[effectivePaymentMethod]})</span>
              <span className="num">{formatMoneyJOD(paid, currency, rates)}</span>
            </div>
            {isDeliverySale && (
              <div className="flex justify-between text-[12px] font-bold text-[var(--muted)]">
                <span>بذمة شركة التوصيل (صافي)</span>
                <span className="num">{formatMoneyJOD(deliveryReceivable, currency, rates)}</span>
              </div>
            )}
            {remaining > 0 && (
              <div className="flex justify-between text-[13px] font-black text-[var(--danger)]">
                <span>
                  {isDeliverySale
                    ? "المتبقي (بذمة شركة التوصيل)"
                    : "المتبقي (دين على العميل)"}
                </span>
                <span className="num">{formatMoneyJOD(remaining, currency, rates)}</span>
              </div>
            )}
            <div className="hr" />
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-black">الإجمالي النهائي ({currency})</span>
              <span className="num text-[22px] font-black text-[var(--mint)]">{formatMoneyJOD(total, currency, rates)}</span>
            </div>
            {isAdmin && (
              <div className="flex justify-between text-[11.5px] font-bold text-[var(--faint)]">
                <span>الربح المتوقع</span>
                <span className="num text-[var(--amber)]">{formatMoneyJOD(Math.max(0, profit - discount), currency, rates)}</span>
              </div>
            )}
          </div>

          <Btn variant="primary" onClick={submit} loading={submitting} disabled={!clientId || !cartEntries.length} className="w-full !py-3.5 !text-[14.5px]">
            <CheckCircle2 size={17} /> حفظ الفاتورة وخصم المخزون
          </Btn>
          {!clientId && cartEntries.length > 0 && (
            <p className="-mt-2 text-center text-[11.5px] font-bold text-[var(--amber)]">
              بقيت خطوة: اختيار العميل لإتمام الحفظ
            </p>
          )}

        </Card>
      </div>
    </div>
  );
}
