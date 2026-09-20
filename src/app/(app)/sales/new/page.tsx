"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Minus,
  Plus,
  ReceiptText,
  Search,
  ShoppingCart,
  Trash2,
  Truck,
  UserPlus,
} from "lucide-react";
import { api } from "@/lib/client";
import { useToast } from "@/components/toast";
import { Badge, Btn, Card, Field, Input, Select, Skeleton, Textarea } from "@/components/ui";
import { ProductImage } from "@/components/ProductImage";
import {
  CLIENT_TYPES,
  SHIPPING_TYPES,
  cls,
  fmtMoney,
  type ClientDTO,
  type ClientType,
  type ProductDTO,
  type ShippingType,
} from "@/lib/shared";

export default function NewSalePage() {
  const router = useRouter();
  const toast = useToast();

  const [products, setProducts] = useState<ProductDTO[] | null>(null);
  const [clients, setClients] = useState<ClientDTO[] | null>(null);
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<Record<number, number>>({});

  const [clientId, setClientId] = useState("");
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [newClient, setNewClient] = useState({ name: "", type: "individual" as ClientType, phone: "" });
  const [addingClient, setAddingClient] = useState(false);

  const [shippingType, setShippingType] = useState<ShippingType>("none");
  const [shippingCost, setShippingCost] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api<ProductDTO[]>("/api/products")
      .then((ps) => setProducts(ps.filter((p) => !p.archived)))
      .catch((e) => toast.push("err", e.message));
    api<ClientDTO[]>("/api/clients")
      .then(setClients)
      .catch((e) => toast.push("err", e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byId = useMemo(() => new Map((products ?? []).map((p) => [p.id, p])), [products]);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return (products ?? []).filter((p) => !n || `${p.name} ${p.category}`.toLowerCase().includes(n));
  }, [products, q]);

  const cartEntries = useMemo(
    () =>
      Object.entries(cart)
        .map(([pid, qty]) => ({ product: byId.get(Number(pid)), qty }))
        .filter((x): x is { product: ProductDTO; qty: number } => !!x.product),
    [cart, byId],
  );

  const subtotal = cartEntries.reduce((a, x) => a + x.product.price * x.qty, 0);
  const profit = cartEntries.reduce((a, x) => a + (x.product.price - x.product.cost) * x.qty, 0);
  const ship = shippingType === "none" ? 0 : Math.max(0, Number(shippingCost) || 0);
  const total = subtotal + ship;

  function addToCart(p: ProductDTO) {
    setCart((c) => {
      const next = (c[p.id] ?? 0) + 1;
      if (next > p.stock) {
        toast.push("info", `"${p.name}" — المتاح ${p.stock} فقط`);
        return c;
      }
      return { ...c, [p.id]: next };
    });
  }

  function setQty(p: ProductDTO, qty: number) {
    setCart((c) => {
      if (qty <= 0) {
        const { [p.id]: _drop, ...rest } = c;
        return rest;
      }
      return { ...c, [p.id]: Math.min(qty, p.stock) };
    });
  }

  function removeLine(pid: number) {
    setCart((c) => {
      const { [pid]: _drop, ...rest } = c;
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
      setNewClient({ name: "", type: "individual", phone: "" });
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
          items: cartEntries.map((x) => ({ productId: x.product.id, quantity: x.qty })),
          shippingType,
          shippingCost: ship,
          notes,
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
              const inCart = cart[p.id] ?? 0;
              return (
                <button
                  key={p.id}
                  onClick={() => !out && addToCart(p)}
                  disabled={out}
                  className={cls(
                    "group relative overflow-hidden rounded-2xl border text-start transition-all",
                    out
                      ? "cursor-not-allowed border-[var(--line-soft)] opacity-45"
                      : inCart > 0
                        ? "border-[rgba(45,230,184,.5)] bg-[rgba(45,230,184,.06)]"
                        : "border-[var(--line-soft)] bg-white/[.02] hover:border-[rgba(45,230,184,.35)] hover:bg-white/[.05]",
                  )}
                >
                  <div className="flex items-start gap-2.5 p-3">
                    <ProductImage src={p.imageUrl} name={p.name} size={46} radius={12} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12.5px] font-extrabold leading-5">{p.name}</div>
                      <div className="num mt-0.5 text-[13px] font-black text-[var(--mint)]">{fmtMoney(p.price)}</div>
                      <div className={cls("num mt-0.5 text-[10.5px] font-bold", out ? "text-[var(--danger)]" : "text-[var(--faint)]")}>
                        {out ? "نفد المخزون" : `متاح: ${p.stock}`}
                      </div>
                    </div>
                  </div>
                  {inCart > 0 && (
                    <span className="absolute left-2.5 top-2.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--mint)] px-1 text-[12px] font-black text-[#04211a]">
                      <span className="num">{inCart}</span>
                    </span>
                  )}
                </button>
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
              <button className="link flex items-center gap-1 text-[11.5px]" onClick={() => setAddClientOpen((s) => !s)}>
                <UserPlus size={13} /> عميل جديد
              </button>
            </div>
            <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">— اختر العميل —</option>
              {(clients ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({CLIENT_TYPES[c.type]})
                </option>
              ))}
            </Select>
            {addClientOpen && (
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
                <Btn size="sm" variant="primary" onClick={quickAddClient} loading={addingClient} disabled={newClient.name.trim().length < 2} className="w-full">
                  حفظ العميل واختياره
                </Btn>
              </div>
            )}
          </div>

          {/* lines */}
          <div className="min-h-[120px]">
            {cartEntries.length === 0 ? (
              <div className="flex h-[120px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--line)] text-[var(--faint)]">
                <ShoppingCart size={22} />
                <span className="text-[12px] font-bold">الفاتورة فارغة — اختر الأصناف من القائمة</span>
              </div>
            ) : (
              <ul className="max-h-[260px] space-y-2 overflow-y-auto pe-1">
                {cartEntries.map(({ product: p, qty }) => (
                  <li key={p.id} className="flex items-center gap-2.5 rounded-2xl border border-[var(--line-soft)] bg-white/[.02] p-2.5">
                    <ProductImage src={p.imageUrl} name={p.name} size={40} radius={10} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12.5px] font-extrabold">{p.name}</div>
                      <div className="num text-[11px] font-bold text-[var(--muted)]">
                        {fmtMoney(p.price)} × {qty} = <span className="text-[var(--mint)]">{fmtMoney(p.price * qty)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button className="icon-btn !h-7 !w-7" onClick={() => setQty(p, qty - 1)}>
                        <Minus size={13} />
                      </button>
                      <span className="num w-7 text-center text-[13px] font-black">{qty}</span>
                      <button className="icon-btn !h-7 !w-7" onClick={() => setQty(p, qty + 1)} disabled={qty >= p.stock}>
                        <Plus size={13} />
                      </button>
                      <button className="icon-btn danger !h-7 !w-7" onClick={() => removeLine(p.id)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* shipping */}
          <div>
            <label className="lbl">الشحن</label>
            <div className="flex gap-2">
              {(Object.keys(SHIPPING_TYPES) as ShippingType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setShippingType(t)}
                  className={cls(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-[12px] font-extrabold transition-all",
                    shippingType === t
                      ? "border-[rgba(45,230,184,.55)] bg-[rgba(45,230,184,.1)] text-[var(--mint)]"
                      : "border-[var(--line-soft)] bg-white/[.02] text-[var(--muted)] hover:bg-white/[.05]",
                  )}
                >
                  <Truck size={13} />
                  {SHIPPING_TYPES[t]}
                </button>
              ))}
            </div>
            {shippingType !== "none" && (
              <div className="mt-2">
                <Input
                  type="number"
                  min="0"
                  step="any"
                  dir="ltr"
                  className="num"
                  placeholder="تكلفة الشحن (تُضاف للفاتورة)"
                  value={shippingCost}
                  onChange={(e) => setShippingCost(e.target.value)}
                />
              </div>
            )}
          </div>

          <Field label="ملاحظات الفاتورة">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="اختياري — تظهر أسفل الفاتورة" />
          </Field>

          {/* totals */}
          <div className="space-y-2 rounded-2xl border border-[var(--line-soft)] bg-white/[.03] p-4">
            <div className="flex justify-between text-[13px] font-bold text-[var(--muted)]">
              <span>الإجمالي الفرعي</span>
              <span className="num">{fmtMoney(subtotal)}</span>
            </div>
            <div className="flex justify-between text-[13px] font-bold text-[var(--muted)]">
              <span>الشحن ({SHIPPING_TYPES[shippingType]})</span>
              <span className="num">{fmtMoney(ship)}</span>
            </div>
            <div className="hr" />
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-black">الإجمالي النهائي</span>
              <span className="num text-[22px] font-black text-[var(--mint)]">{fmtMoney(total)}</span>
            </div>
            <div className="flex justify-between text-[11.5px] font-bold text-[var(--faint)]">
              <span>الربح المتوقع</span>
              <span className="num text-[var(--amber)]">{fmtMoney(profit)}</span>
            </div>
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
