"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArchiveRestore,
  Barcode,
  Boxes,
  CircleAlert,
  ImagePlus,
  Package,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { api, fileToDataUrl } from "@/lib/client";
import { useToast } from "@/components/toast";
import {
  Badge,
  Btn,
  Card,
  ConfirmDialog,
  Empty,
  Field,
  Input,
  Modal,
  Select,
  Skeleton,
  Textarea,
} from "@/components/ui";
import ImageZoom, { ProductImage } from "@/components/ProductImage";
import CurrencySwitcher from "@/components/CurrencySwitcher";
import { useCurrency } from "@/components/useCurrency";
import { formatMoneyJOD } from "@/lib/currency";
import {
  cls,
  fmtNum,
  NICOTINE_LEVELS,
  PRODUCT_SIZES,
  type ProductDTO,
  type SessionUserDTO,
} from "@/lib/shared";

type FormVariant = {
  id?: number;
  size: string;
  nicotine: string;
  retailPrice: string;
  wholesalePrice: string;
  cost: string;
  stock: string;
  lowStockAt: string;
};

type FormState = {
  name: string;
  category: string;
  description: string;
  price: string;
  cost: string;
  stock: string;
  lowStockAt: string;
  barcode: string;
  imageUrl: string;
  fields: Array<{ label: string; value: string }>;
  variants: FormVariant[];
};

const EMPTY_FORM: FormState = {
  name: "",
  category: "",
  description: "",
  price: "",
  cost: "",
  stock: "",
  lowStockAt: "5",
  barcode: "",
  imageUrl: "",
  fields: [],
  variants: [],
};

const FIELD_PRESETS = ["VG / PG", "بلد الصنع", "نوع الكويل"];
const EMPTY_VARIANT: FormVariant = {
  size: "60ml",
  nicotine: "30mg",
  retailPrice: "",
  wholesalePrice: "",
  cost: "",
  stock: "0",
  lowStockAt: "5",
};

export default function ProductsPage() {
  const toast = useToast();
  const { currency, settings, rates } = useCurrency();
  const [me, setMe] = useState<SessionUserDTO | null>(null);
  const [items, setItems] = useState<ProductDTO[] | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProductDTO | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [stockTarget, setStockTarget] = useState<ProductDTO | null>(null);
  const [delta, setDelta] = useState("");
  const [stockNote, setStockNote] = useState("");
  const [stockVariantId, setStockVariantId] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  const [archiveTarget, setArchiveTarget] = useState<ProductDTO | null>(null);
  const [archiving, setArchiving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    try {
      const data = await api<ProductDTO[]>(
        `/api/products${showArchived ? "?archived=1" : ""}`,
      );
      setItems(data);
    } catch (e) {
      toast.push("err", e instanceof Error ? e.message : "تعذر التحميل");
      setItems([]);
    }
  }

  useEffect(() => {
    api<SessionUserDTO>("/api/auth/me").then(setMe).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showArchived]);

  const categories = useMemo(
    () => [...new Set((items ?? []).map((p) => p.category).filter(Boolean))],
    [items],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (items ?? []).filter((p) => {
      if (showArchived ? !p.archived : p.archived) return false;
      if (cat && p.category !== cat) return false;
      if (needle && !`${p.name} ${p.category}`.toLowerCase().includes(needle))
        return false;
      return true;
    });
  }, [items, q, cat, showArchived]);

  function openCreate() {
    if (me && me.role !== "admin") return;
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEdit(p: ProductDTO) {
    if (me && me.role !== "admin") return;
    setEditing(p);
    setForm({
      name: p.name,
      category: p.category,
      description: p.description,
      price: String(p.price),
      cost: String(p.cost),
      stock: String(p.stock),
      lowStockAt: String(p.lowStockAt),
      barcode: p.barcode,
      imageUrl: p.imageUrl,
      fields: p.fields.map((f) => ({ label: f.label, value: f.value })),
      variants: p.variants.map((v) => ({
        id: v.id,
        size: v.size,
        nicotine: v.nicotine,
        retailPrice: String(v.retailPrice),
        wholesalePrice: String(v.wholesalePrice),
        cost: String(v.cost),
        stock: String(v.stock),
        lowStockAt: String(v.lowStockAt),
      })),
    });
    setFormOpen(true);
  }

  async function saveProduct() {
    if (saving) return;
    setSaving(true);
    const payload = {
      name: form.name,
      category: form.category,
      description: form.description,
      price: Number(form.price) || 0,
      cost: Number(form.cost) || 0,
      stock: Number(form.stock) || 0,
      lowStockAt: Number(form.lowStockAt) || 0,
      barcode: form.barcode,
      imageUrl: form.imageUrl,
      fields: form.fields.filter((f) => f.label.trim() && f.value.trim()),
      variants: form.variants.map((v) => ({
        ...v,
        retailPrice: Number(v.retailPrice) || 0,
        wholesalePrice: Number(v.wholesalePrice) || 0,
        cost: v.cost.trim() ? Number(v.cost) : Number(form.cost) || 0,
        stock: Number(v.stock) || 0,
        lowStockAt: Number(v.lowStockAt) || 0,
      })),
    };
    try {
      if (editing) {
        await api(`/api/products/${editing.id}`, {
          method: "PATCH",
          body: { mode: "edit", ...payload },
        });
        toast.push("ok", "تم حفظ تعديلات المنتج");
      } else {
        await api("/api/products", { method: "POST", body: payload });
        toast.push("ok", "تمت إضافة المنتج بنجاح");
      }
      setFormOpen(false);
      await load();
    } catch (e) {
      toast.push("err", e instanceof Error ? e.message : "تعذر الحفظ");
    } finally {
      setSaving(false);
    }
  }

  async function applyStock() {
    if (!stockTarget || adjusting) return;
    const d = Math.trunc(Number(delta));
    if (!d) {
      toast.push("info", "أدخل قيمة تعديل (موجبة للإضافة، سالبة للخصم)");
      return;
    }
    setAdjusting(true);
    try {
      const updated = await api<ProductDTO>(`/api/products/${stockTarget.id}`, {
        method: "PATCH",
        body: {
          mode: "adjustStock",
          delta: d,
          note: stockNote,
          ...(stockVariantId ? { variantId: Number(stockVariantId) } : {}),
        },
      });
      toast.push("ok", `مخزون "${updated.name}" أصبح ${updated.stock}`);
      setStockTarget(null);
      setDelta("");
      setStockNote("");
      setStockVariantId("");
      await load();
    } catch (e) {
      toast.push("err", e instanceof Error ? e.message : "تعذر التعديل");
    } finally {
      setAdjusting(false);
    }
  }

  async function archiveProduct() {
    if (!archiveTarget || archiving) return;
    setArchiving(true);
    try {
      await api(`/api/products/${archiveTarget.id}`, { method: "DELETE" });
      toast.push("ok", `تمت أرشفة "${archiveTarget.name}"`);
      setArchiveTarget(null);
      await load();
    } catch (e) {
      toast.push("err", e instanceof Error ? e.message : "تعذرت الأرشفة");
    } finally {
      setArchiving(false);
    }
  }

  async function restoreProduct(p: ProductDTO) {
    try {
      await api(`/api/products/${p.id}`, {
        method: "PATCH",
        body: { mode: "restore" },
      });
      toast.push("ok", `تمت استعادة "${p.name}"`);
      await load();
    } catch (e) {
      toast.push("err", e instanceof Error ? e.message : "تعذرت الاستعادة");
    }
  }

  async function pickImage(file: File | null) {
    if (!file) return;
    try {
      const url = await fileToDataUrl(file);
      setForm((f) => ({ ...f, imageUrl: url }));
    } catch (e) {
      toast.push("err", e instanceof Error ? e.message : "تعذر تحميل الصورة");
    }
  }

  const profit = (Number(form.price) || 0) - (Number(form.cost) || 0);
  const validVariants = form.variants.every(
    (v) =>
      PRODUCT_SIZES.includes(v.size as (typeof PRODUCT_SIZES)[number]) &&
      NICOTINE_LEVELS.includes(v.nicotine as (typeof NICOTINE_LEVELS)[number]) &&
      Number(v.retailPrice) >= 0 &&
      Number(v.wholesalePrice) >= 0 &&
      (v.cost.trim() === "" || Number(v.cost) >= 0) &&
      Number(v.stock) >= 0,
  );
  const valid =
    form.name.trim().length >= 2 &&
    validVariants &&
    (form.variants.length > 0
      ? form.variants.some((v) => Number(v.retailPrice) > 0 || Number(v.wholesalePrice) > 0)
      : Number(form.price) > 0);

  return (
    <div className="space-y-5">
      {/* toolbar */}
      <div className="anim-in flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[220px] flex-1">
          <input
            className="inp ps-10"
            placeholder="ابحث عن صنف أو نكهة…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Search
            size={16}
            className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-[var(--faint)]"
          />
        </div>
        <Select
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          className="!w-auto"
        >
          <option value="">كل التصنيفات</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        {me?.role === "admin" && (
          <Btn
            variant={showArchived ? "primary" : "ghost"}
            size="sm"
            onClick={() => setShowArchived((s) => !s)}
          >
            <ArchiveRestore size={15} />
            {showArchived ? "الأصناف النشطة" : "الأرشيف"}
          </Btn>
        )}
        {!showArchived &&
          (items ?? []).some((p) => !p.archived && p.stock <= p.lowStockAt) && (
            <div className="flex items-center gap-2 rounded-2xl border border-amber-500/35 bg-amber-500/10 px-4 py-2.5 text-[12.5px] font-extrabold text-amber-400">
              <CircleAlert size={16} className="shrink-0" />
              تنبيه نقص المخزون:{" "}
              <span className="num">
                {(items ?? []).filter((p) => !p.archived && p.stock <= p.lowStockAt).length}
              </span>{" "}
              صنف تحت حد التنبيه
            </div>
          )}
        <CurrencySwitcher defaultCurrency={settings?.defaultCurrency} compact />
        {me?.role === "admin" && (
          <Btn variant="primary" size="sm" onClick={openCreate}>
            <Plus size={15} /> إضافة منتج
          </Btn>
        )}
        {me?.role !== "admin" && (
          <span className="badge badge-slate">وضع الموظف — إجمالي المبيعات والمخزون فقط</span>
        )}
      </div>

      {/* grid */}
      {!items ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[290px]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <Empty
            icon={<Package size={22} />}
            title={showArchived ? "الأرشيف فارغ" : "لا توجد أصناف مطابقة"}
            hint={showArchived ? "لم يتم أرشفة أي منتج بعد" : "أضف أول منتج لبدء البيع وإصدار الفواتير"}
            action={
              !showArchived && me?.role === "admin" ? (
                <Btn variant="primary" size="sm" onClick={openCreate}>
                  <Plus size={15} /> إضافة منتج
                </Btn>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p, i) => {
            const pProfit = p.price - p.cost;
            const out = p.stock === 0;
            const low = !out && p.stock <= p.lowStockAt;
            return (
              <article
                key={p.id}
                className={cls(
                  "panel panel-hover anim-in flex flex-col overflow-hidden",
                  i % 4 === 1 && "anim-d1",
                  i % 4 === 2 && "anim-d2",
                  i % 4 === 3 && "anim-d3",
                  p.archived && "opacity-60",
                )}
              >
                <div className="relative">
                  {p.imageUrl ? (
                    <ImageZoom
                      src={p.imageUrl}
                      name={p.name}
                      size={160}
                      radius={0}
                      className="group block h-40 w-full"
                      imageClassName="h-full w-full rounded-none"
                    />
                  ) : (
                    <div className="flex h-40 items-center justify-center">
                      <ProductImage src="" name={p.name} size={76} radius={20} />
                    </div>
                  )}
                  <div className="absolute inset-x-0 top-0 flex items-start justify-between p-2.5">
                    {out ? (
                      <Badge tone="rose">
                        <CircleAlert size={11} /> نفد المخزون
                      </Badge>
                    ) : low ? (
                      <Badge tone="amber">مخزون منخفض</Badge>
                    ) : (
                      <Badge tone="mint">متوفر</Badge>
                    )}
                    {p.archived && <Badge tone="slate">مؤرشف</Badge>}
                  </div>
                </div>

                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-[14.5px] font-extrabold">{p.name}</h3>
                      {p.category && (
                        <span className="mt-1 inline-block text-[11px] font-bold text-[var(--faint)]">
                          {p.category}
                        </span>
                      )}
                    </div>
                    <div className="text-end leading-tight">
                      <div className="num text-[15px] font-black text-[var(--mint)]">
                        {formatMoneyJOD(p.price, currency, rates)}
                      </div>
                      <div className="num text-[10.5px] font-bold text-[var(--faint)]">
                        {me?.role === "admin" ? <>ربح: {formatMoneyJOD(pProfit, currency, rates)}</> : <>المتبقي: {fmtNum(p.stock)}</>}
                      </div>
                    </div>
                  </div>

                  {p.fields.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {p.fields.slice(0, 3).map((f, j) => (
                        <span
                          key={j}
                          className="rounded-lg border border-[var(--line-soft)] bg-white/[.03] px-2 py-1 text-[10.5px] font-bold text-[var(--muted)]"
                        >
                          {f.label}: <span className="text-[var(--text)]">{f.value}</span>
                        </span>
                      ))}
                      {p.fields.length > 3 && (
                        <span className="px-1 py-1 text-[10.5px] font-bold text-[var(--faint)]">
                          +{p.fields.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="mt-auto flex items-center justify-between border-t border-[var(--line-soft)] pt-3">
                    <div className="text-[12px] font-extrabold">
                      <span className="text-[var(--faint)]">المخزون: </span>
                      <span className={cls("num", out ? "text-[var(--danger)]" : low ? "text-[var(--amber)]" : "text-[var(--text)]")}>
                        {fmtNum(p.stock)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {me?.role === "admin" && (
                        <button
                          className="icon-btn"
                          title="تعديل المخزون"
                          onClick={() => {
                            setStockTarget(p);
                            setDelta("");
                            setStockNote("");
                            setStockVariantId(p.variants[0] ? String(p.variants[0].id) : "");
                          }}
                        >
                          <Boxes size={15} />
                        </button>
                      )}
                      {me?.role === "admin" && (
                        <button className="icon-btn" title="تعديل" onClick={() => openEdit(p)}>
                          <Pencil size={15} />
                        </button>
                      )}
                      {me?.role === "admin" &&
                        (p.archived ? (
                          <button className="icon-btn" title="استعادة" onClick={() => restoreProduct(p)}>
                            <ArchiveRestore size={15} />
                          </button>
                        ) : (
                          <button
                            className="icon-btn danger"
                            title="أرشفة"
                            onClick={() => setArchiveTarget(p)}
                          >
                            <Trash2 size={15} />
                          </button>
                        ))}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* ===== create / edit modal ===== */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `تعديل: ${editing.name}` : "إضافة منتج جديد"}
        icon={<Package size={17} />}
        wide
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="اسم المنتج *">
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="مثال: مانجو آيس 60مل"
            />
          </Field>
          <Field label="التصنيف">
            <Input
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              placeholder="سولت نيكوتين / فري بيز / بود…"
            />
          </Field>
          <Field label="سعر البيع *">
            <Input
              type="number"
              min="0"
              step="any"
              dir="ltr"
              className="num"
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              placeholder="0.00"
            />
          </Field>
          <Field label="سعر التكلفة (لحساب الربح)">
            <Input
              type="number"
              min="0"
              step="any"
              dir="ltr"
              className="num"
              value={form.cost}
              onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))}
              placeholder="0.00"
            />
          </Field>
          <Field label="الكمية بالمخزون">
            <Input
              type="number"
              min="0"
              step="1"
              dir="ltr"
              className="num"
              value={form.stock}
              onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
              placeholder="0"
            />
          </Field>
          <Field label="حد تنبيه نقص المخزون">
            <Input
              type="number"
              min="0"
              step="1"
              dir="ltr"
              className="num"
              value={form.lowStockAt}
              onChange={(e) => setForm((f) => ({ ...f, lowStockAt: e.target.value }))}
              placeholder="5"
            />
          </Field>
          <Field label="الباركود" hint="رقم باركود للمسح السريع في فاتورة جديدة (اختياري)">
            <Input
              dir="ltr"
              className="num"
              value={form.barcode}
              onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value }))}
              placeholder="6291100000015"
            />
          </Field>
          <div className="md:col-span-2">
            <Field label="الوصف">
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="نبذة مختصرة عن النكهة أو المنتج…"
              />
            </Field>
          </div>

          {/* image */}
          <div className="md:col-span-2">
            <label className="lbl">صورة المنتج</label>
            <div className="flex flex-wrap items-center gap-3">
              {form.imageUrl ? (
                <div className="relative">
                  <ImageZoom
                    src={form.imageUrl}
                    name={form.name || "صورة المنتج"}
                    size={96}
                    radius={16}
                    className="h-24 w-24"
                    imageClassName="h-full w-full rounded-2xl"
                  />
                  <button
                    type="button"
                    className="icon-btn danger absolute -top-2 -left-2 !h-6 !w-6"
                    onClick={() => setForm((f) => ({ ...f, imageUrl: "" }))}
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex h-24 w-24 flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-[var(--line)] text-[var(--faint)] transition-colors hover:border-[var(--mint)] hover:text-[var(--mint)]"
                >
                  <ImagePlus size={22} />
                  <span className="text-[10px] font-bold">رفع صورة</span>
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => pickImage(e.target.files?.[0] ?? null)}
              />
              <div className="min-w-[220px] flex-1">
                <Input
                  value={form.imageUrl.startsWith("data:") ? "" : form.imageUrl}
                  onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                  placeholder="أو الصق رابط صورة https://…"
                  dir="ltr"
                />
              </div>
            </div>
          </div>

          <div className="md:col-span-2">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <label className="lbl !mb-0">المقاسات والنيكوتين والأسعار</label>
                <p className="mt-1 text-[11px] font-semibold text-[var(--faint)]">
                  اربط كل حجم ونيكوتين بسعر الأفراد وسعر المحلات/الجملة ومخزون مستقل.
                </p>
              </div>
              <Btn
                type="button"
                size="xs"
                onClick={() =>
                  setForm((f) => ({ ...f, variants: [...f.variants, { ...EMPTY_VARIANT }] }))
                }
              >
                <Plus size={13} /> إضافة خيار
              </Btn>
            </div>
            {form.variants.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--line)] p-4 text-center text-[12px] font-bold text-[var(--faint)]">
                لا توجد خيارات بعد — اضغط «إضافة خيار» لتحديد الحجم والنيكوتين وأسعاره.
              </div>
            ) : (
              <div className="space-y-3">
                {form.variants.map((variant, index) => (
                  <div key={variant.id ?? `new-${index}`} className="rounded-2xl border border-[var(--line-soft)] bg-white/[.02] p-3">
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
                      <Field label="الحجم *">
                        <Select
                          value={variant.size}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              variants: f.variants.map((v, i) =>
                                i === index ? { ...v, size: e.target.value } : v,
                              ),
                            }))
                          }
                        >
                          {PRODUCT_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
                        </Select>
                      </Field>
                      <Field label="النيكوتين *">
                        <Select
                          value={variant.nicotine}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              variants: f.variants.map((v, i) =>
                                i === index ? { ...v, nicotine: e.target.value } : v,
                              ),
                            }))
                          }
                        >
                          {NICOTINE_LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}
                        </Select>
                      </Field>
                      <Field label="سعر الأفراد *">
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          dir="ltr"
                          className="num"
                          value={variant.retailPrice}
                          onChange={(e) => setForm((f) => ({ ...f, variants: f.variants.map((v, i) => i === index ? { ...v, retailPrice: e.target.value } : v) }))}
                        />
                      </Field>
                      <Field label="سعر الجملة *">
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          dir="ltr"
                          className="num"
                          value={variant.wholesalePrice}
                          onChange={(e) => setForm((f) => ({ ...f, variants: f.variants.map((v, i) => i === index ? { ...v, wholesalePrice: e.target.value } : v) }))}
                        />
                      </Field>
                      <Field label="تكلفة الخيار">
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          dir="ltr"
                          className="num"
                          value={variant.cost}
                          onChange={(e) => setForm((f) => ({ ...f, variants: f.variants.map((v, i) => i === index ? { ...v, cost: e.target.value } : v) }))}
                        />
                      </Field>
                      <Field label="المخزون">
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          dir="ltr"
                          className="num"
                          value={variant.stock}
                          onChange={(e) => setForm((f) => ({ ...f, variants: f.variants.map((v, i) => i === index ? { ...v, stock: e.target.value } : v) }))}
                        />
                      </Field>
                      <Field label="تنبيه نقص">
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          dir="ltr"
                          className="num"
                          value={variant.lowStockAt}
                          onChange={(e) => setForm((f) => ({ ...f, variants: f.variants.map((v, i) => i === index ? { ...v, lowStockAt: e.target.value } : v) }))}
                        />
                      </Field>
                    </div>
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        className="icon-btn danger"
                        title="حذف الخيار"
                        onClick={() => setForm((f) => ({ ...f, variants: f.variants.filter((_, i) => i !== index) }))}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* dynamic fields */}
          <div className="md:col-span-2">
            <div className="mb-2 flex items-center justify-between">
              <label className="lbl !mb-0">حقول إضافية (مواصفات / تكاليف خاصة)</label>
              <Btn
                size="xs"
                onClick={() =>
                  setForm((f) => ({ ...f, fields: [...f.fields, { label: "", value: "" }] }))
                }
              >
                <Plus size={13} /> حقل جديد
              </Btn>
            </div>
            {form.fields.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {FIELD_PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className="rounded-lg border border-[var(--line-soft)] bg-white/[.03] px-2 py-1 text-[10.5px] font-bold text-[var(--muted)] transition-colors hover:text-[var(--mint)]"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        fields: [...f.fields, { label: p, value: "" }],
                      }))
                    }
                  >
                    + {p}
                  </button>
                ))}
              </div>
            )}
            <div className="space-y-2">
              {form.fields.map((fld, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={fld.label}
                    placeholder="اسم الحقل"
                    className="!w-[38%]"
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        fields: f.fields.map((x, j) =>
                          j === i ? { ...x, label: e.target.value } : x,
                        ),
                      }))
                    }
                  />
                  <Input
                    value={fld.value}
                    placeholder="القيمة"
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        fields: f.fields.map((x, j) =>
                          j === i ? { ...x, value: e.target.value } : x,
                        ),
                      }))
                    }
                  />
                  <button
                    type="button"
                    className="icon-btn danger shrink-0"
                    onClick={() =>
                      setForm((f) => ({ ...f, fields: f.fields.filter((_, j) => j !== i) }))
                    }
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              {form.fields.length === 0 && (
                <p className="text-[11.5px] font-semibold text-[var(--faint)]">
                  لا توجد حقول إضافية — أضف أي مواصفة خاصة (نيكوتين، حجم، نسبة VG…)
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-[var(--line-soft)] pt-4">
          <span className="num text-[12.5px] font-bold text-[var(--muted)]">
            هامش الربح ({currency}): <span className={profit >= 0 ? "text-[var(--mint)]" : "text-[var(--danger)]"}>{formatMoneyJOD(profit, currency, rates)}</span>
          </span>
          <div className="flex gap-2">
            <Btn onClick={() => setFormOpen(false)}>إلغاء</Btn>
            <Btn variant="primary" onClick={saveProduct} loading={saving} disabled={!valid}>
              {editing ? "حفظ التعديلات" : "إضافة المنتج"}
            </Btn>
          </div>
        </div>
      </Modal>

      {/* ===== stock adjust modal ===== */}
      <Modal
        open={!!stockTarget}
        onClose={() => setStockTarget(null)}
        title={stockTarget ? `تعديل مخزون: ${stockTarget.name}` : ""}
        icon={<SlidersHorizontal size={17} />}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl border border-[var(--line-soft)] bg-white/[.03] px-4 py-3">
            <span className="text-[12.5px] font-bold text-[var(--muted)]">الرصيد الحالي</span>
            <span className="num text-[20px] font-black">{stockTarget?.stock ?? 0}</span>
          </div>
           {stockTarget && stockTarget.variants.length > 0 && (
             <Field label="الحجم والنيكوتين *">
               <Select
                 value={stockVariantId}
                 onChange={(e) => setStockVariantId(e.target.value)}
               >
                 {stockTarget.variants.map((v) => (
                   <option key={v.id} value={v.id}>
                     {v.size} — {v.nicotine} (الحالي {v.stock})
                   </option>
                 ))}
               </Select>
             </Field>
           )}
           <Field label="قيمة التعديل (+ إضافة / − خصم)" hint="مثال: 24+ لاستلام شحنة، أو 3- لتالف">
            <Input
              type="number"
              step="1"
              dir="ltr"
              className="num"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              placeholder="مثال: 24 أو -3"
              autoFocus
            />
          </Field>
          <Field label="ملاحظة (اختياري)">
            <Input
              value={stockNote}
              onChange={(e) => setStockNote(e.target.value)}
              placeholder="استلام شحنة مورد / تسوية جرد…"
            />
          </Field>
          <div className="flex items-center justify-between border-t border-[var(--line-soft)] pt-4">
            <span className="num text-[12.5px] font-bold text-[var(--muted)]">
              الرصيد بعد التعديل:{" "}
              <span className={(stockTarget?.stock ?? 0) + (Math.trunc(Number(delta)) || 0) >= 0 ? "text-[var(--mint)]" : "text-[var(--danger)]"}>
                {(stockTarget?.stock ?? 0) + (Math.trunc(Number(delta)) || 0)}
              </span>
            </span>
            <Btn variant="primary" onClick={applyStock} loading={adjusting}>
              تطبيق التعديل
            </Btn>
          </div>
        </div>
      </Modal>

      {/* ===== archive confirm ===== */}
      <ConfirmDialog
        open={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        onConfirm={archiveProduct}
        loading={archiving}
        title="أرشفة المنتج"
        message={`سيتم إخفاء "${archiveTarget?.name}" من البيع والقوائم، مع بقاء الفواتير السابقة كما هي. يمكن استعادته لاحقًا من الأرشيف.`}
        confirmText="أرشفة"
      />
    </div>
  );
}
