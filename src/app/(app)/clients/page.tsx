"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  MapPinned,
  Pencil,
  Phone,
  Plus,
  Search,
  Store,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { api } from "@/lib/client";
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
import { ProductImage } from "@/components/ProductImage";
import CurrencySwitcher from "@/components/CurrencySwitcher";
import { useCurrency } from "@/components/useCurrency";
import { formatMoneyJOD } from "@/lib/currency";
import {
  CLIENT_SECTIONS,
  CLIENT_TYPES,
  cls,
  fmtDate,
  fmtDateTime,
  fmtNum,
  invoiceNo,
  isShopClient,
  type ClientDTO,
  type ClientSection,
  type ClientType,
  type SessionUserDTO,
  type ShippingType,
} from "@/lib/shared";
import { can } from "@/lib/permissions";

const TYPE_ICONS: Record<ClientType, typeof Store> = {
  store: Store,
  company: Building2,
  individual: User,
};
const TYPE_TONES: Record<ClientType, string> = {
  store: "mint",
  company: "violet",
  individual: "sky",
};

type ClientDetail = {
  client: {
    id: number;
    name: string;
    type: ClientType;
    phone: string;
    phone2: string;
    address: string;
    googleMapsUrl: string;
    distributionMapUrl: string;
    notes: string;
    createdAt: string;
  };
  stats: {
    orders: number;
    total: number;
    avg?: number;
    lastOrderAt?: string | null;
    debt?: number;
  };
  purchases: Array<{
    id: number;
    invoice: string;
    createdAt: string;
    status: string;
    shippingType: ShippingType;
    subtotal: number;
    shippingCost: number;
    total: number;
    userName: string;
    items: Array<{
      productName: string;
      imageUrl: string;
      quantity: number;
      price: number;
      lineTotal: number;
    }>;
  }>;
};

const EMPTY_FORM = {
  name: "",
  type: "individual" as ClientType,
  phone: "",
  phone2: "",
  address: "",
  googleMapsUrl: "",
  distributionMapUrl: "",
  notes: "",
};

export default function ClientsPage() {
  const toast = useToast();
  const { currency, settings, rates } = useCurrency();
  const [me, setMe] = useState<SessionUserDTO | null>(null);
  const [items, setItems] = useState<ClientDTO[] | null>(null);
  const [q, setQ] = useState("");
  const [section, setSection] = useState<ClientSection>("individuals");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ClientDTO | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [detail, setDetail] = useState<ClientDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<ClientDTO | null>(null);
  const [deleting, setDeleting] = useState(false);

  // الصلاحيات يحددها الأدمن: الأزرار المخفية + منع التنفيذ من الـ API.
  const canCreate = can(me, "clients.create");
  const canEdit = can(me, "clients.update");
  const canDelete = can(me, "clients.delete");
  const formIsShop = isShopClient(form.type);

  async function load() {
    try {
      setItems(await api<ClientDTO[]>("/api/clients"));
    } catch (e) {
      toast.push("err", e instanceof Error ? e.message : "تعذر التحميل");
      setItems([]);
    }
  }

  useEffect(() => {
    api<SessionUserDTO>("/api/auth/me").then(setMe).catch(() => {});
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return (items ?? []).filter((c) => {
      const inSection = section === "shops" ? isShopClient(c.type) : c.type === "individual";
      const matches = !n || `${c.name} ${c.phone} ${c.phone2 ?? ""}`.toLowerCase().includes(n);
      return inSection && matches;
    });
  }, [items, q, section]);

  async function openDetail(id: number) {
    setDetailId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      setDetail(await api<ClientDetail>(`/api/clients/${id}`));
    } catch (e) {
      toast.push("err", e instanceof Error ? e.message : "تعذر التحميل");
      setDetailId(null);
    } finally {
      setDetailLoading(false);
    }
  }

  function openCreate(nextSection: ClientSection = section) {
    if (!canEdit) return;
    setSection(nextSection);
    setEditing(null);
    setForm({ ...EMPTY_FORM, type: nextSection === "shops" ? "store" : "individual" });
    setFormOpen(true);
  }

  function openEdit(c: ClientDTO) {
    if (!canEdit) return;
    setEditing(c);
    setSection(isShopClient(c.type) ? "shops" : "individuals");
    setForm({
      name: c.name,
      type: c.type,
      phone: c.phone,
      phone2: c.phone2 ?? "",
      address: c.address,
      googleMapsUrl: c.googleMapsUrl ?? "",
      distributionMapUrl: c.distributionMapUrl ?? "",
      notes: c.notes,
    });
    setFormOpen(true);
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      if (editing) {
        await api(`/api/clients/${editing.id}`, { method: "PATCH", body: form });
        toast.push("ok", "تم حفظ بيانات العميل");
      } else {
        await api("/api/clients", { method: "POST", body: form });
        toast.push("ok", "تمت إضافة العميل");
      }
      setFormOpen(false);
      await load();
    } catch (e) {
      toast.push("err", e instanceof Error ? e.message : "تعذر الحفظ");
    } finally {
      setSaving(false);
    }
  }

  async function doDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await api(`/api/clients/${deleteTarget.id}`, { method: "DELETE" });
      toast.push("ok", `تم حذف "${deleteTarget.name}"`);
      setDeleteTarget(null);
      await load();
    } catch (e) {
      toast.push("err", e instanceof Error ? e.message : "تعذر الحذف");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="anim-in flex flex-wrap items-center gap-2.5">
        <div className="flex w-full gap-2 rounded-2xl border border-[var(--line-soft)] bg-white/[.02] p-1 sm:w-auto">
          {(["individuals", "shops"] as ClientSection[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setSection(key)}
              className={cls(
                "flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[12px] font-extrabold transition-colors sm:flex-none",
                section === key
                  ? "bg-[var(--mint)] text-[#04211a]"
                  : "text-[var(--muted)] hover:bg-white/[.05]",
              )}
            >
              {key === "individuals" ? <User size={15} /> : <Store size={15} />}
              {CLIENT_SECTIONS[key]}
            </button>
          ))}
        </div>
        <div className="relative min-w-[220px] flex-1">
          <input
            className="inp ps-10"
            placeholder="ابحث بالاسم أو الهاتف…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Search size={16} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
        </div>
        {canEdit && (
          <Btn variant="primary" size="sm" onClick={() => openCreate(section)}>
            <Plus size={15} /> إضافة {section === "shops" ? "محل" : "فرد"}
          </Btn>
        )}
        <CurrencySwitcher defaultCurrency={settings?.defaultCurrency} compact />
      </div>

      <Card className="anim-in anim-d1 overflow-hidden" bodyClass="overflow-x-auto">
        {!items ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Empty
            icon={<Users size={22} />}
            title="لا يوجد عملاء"
            hint={canEdit ? "أضف عملاءك (محلات / متاجر / أفراد) لربطهم بالفواتير" : "لا يوجد عملاء مسجلون في هذا القسم"}
            action={
              canEdit ? (
                <Btn variant="primary" size="sm" onClick={() => openCreate(section)}>
                  <Plus size={15} /> إضافة {section === "shops" ? "محل" : "فرد"}
                </Btn>
              ) : undefined
            }
          />
        ) : (
          <table className="tbl min-w-[720px]">
            <thead>
              <tr>
                <th>العميل</th>
                <th>النوع</th>
                <th>الهاتف</th>
                <th>عدد الفواتير</th>
                <th>إجمالي المشتريات</th>
                <th>منذ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const Icon = TYPE_ICONS[c.type];
                return (
                  <tr key={c.id} className="cursor-pointer" onClick={() => openDetail(c.id)}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                          style={{ background: "rgba(255,255,255,.05)", border: "1px solid var(--line-soft)", color: "var(--muted)" }}
                        >
                          <Icon size={16} />
                        </div>
                        <span className="font-extrabold">{c.name}</span>
                      </div>
                    </td>
                    <td>
                      <Badge tone={TYPE_TONES[c.type]}>{CLIENT_TYPES[c.type]}</Badge>
                    </td>
                    <td>
                      <div className="leading-tight">
                        <div className="num text-[12.5px] font-bold text-[var(--muted)]">
                          {c.phone || "—"}
                        </div>
                        {c.phone2 && (
                          <div className="num text-[11px] font-bold text-[var(--faint)]" dir="ltr">
                            {c.phone2}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="num font-black">{fmtNum(c.ordersCount)}</span>
                    </td>
                    <td>
                      <span className="num font-black text-[var(--mint)]">{formatMoneyJOD(c.totalSpent, currency, rates)}</span>
                    </td>
                    <td>
                      <span className="text-[12px] font-bold text-[var(--faint)]">{fmtDate(c.createdAt)}</span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {canEdit && (
                          <button className="icon-btn" title="تعديل" onClick={() => openEdit(c)}>
                            <Pencil size={14} />
                          </button>
                        )}
                        {canDelete && (
                          <button className="icon-btn danger" title="حذف" onClick={() => setDeleteTarget(c)}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {/* ===== form modal ===== */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `تعديل: ${editing.name}` : "إضافة عميل جديد"}
        icon={<Users size={17} />}
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="الاسم *">
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={formIsShop ? "اسم المحل أو المتجر" : "اسم العميل"}
              />
            </Field>
            <Field label="القسم">
              <Select
                value={formIsShop ? "shops" : "individuals"}
                onChange={(e) => {
                  const shop = e.target.value === "shops";
                  setSection(shop ? "shops" : "individuals");
                  setForm((f) => ({
                    ...f,
                    type: shop ? "store" : "individual",
                    ...(shop ? {} : { googleMapsUrl: "", distributionMapUrl: "", address: "" }),
                  }));
                }}
              >
                <option value="individuals">العملاء الأفراد</option>
                <option value="shops">المحلات والمتاجر</option>
              </Select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="رقم الهاتف">
              <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="01xxxxxxxxx" dir="ltr" className="num" />
            </Field>
            <Field label="رقم هاتف ثانٍ (اختياري)">
              <Input
                value={form.phone2}
                onChange={(e) => setForm((f) => ({ ...f, phone2: e.target.value }))}
                placeholder="07xxxxxxxx"
                dir="ltr"
                className="num"
              />
            </Field>
          </div>
          {formIsShop && (
            <>
              <Field label="العنوان" hint="العنوان التفصيلي للمحل">
                <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="المحافظة — المنطقة — الشارع" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Google Maps Location" hint="رابط موقع المحل على الخريطة">
                  <Input
                    type="url"
                    value={form.googleMapsUrl}
                    onChange={(e) => setForm((f) => ({ ...f, googleMapsUrl: e.target.value }))}
                    placeholder="https://maps.google.com/…"
                    dir="ltr"
                  />
                </Field>
                <Field label="Distribution Map" hint="رابط خريطة التوزيع الكبرى">
                  <Input
                    type="url"
                    value={form.distributionMapUrl}
                    onChange={(e) => setForm((f) => ({ ...f, distributionMapUrl: e.target.value }))}
                    placeholder="https://maps.google.com/…"
                    dir="ltr"
                  />
                </Field>
              </div>
            </>
          )}
          <Field label="ملاحظات">
            <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="شروط تعامل، أسعار خاصة…" />
          </Field>
          <div className="flex justify-end gap-2 border-t border-[var(--line-soft)] pt-4">
            <Btn onClick={() => setFormOpen(false)}>إلغاء</Btn>
            <Btn variant="primary" onClick={save} loading={saving} disabled={form.name.trim().length < 2}>
              {editing ? "حفظ التعديلات" : "إضافة العميل"}
            </Btn>
          </div>
        </div>
      </Modal>

      {/* ===== detail modal (purchase history) ===== */}
      <Modal
        open={detailId !== null}
        onClose={() => setDetailId(null)}
        title={detail ? detail.client.name : "سجل المشتريات"}
        icon={<ReceiptIcon />}
        wide
      >
        {detailLoading || !detail ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={TYPE_TONES[detail.client.type]}>{CLIENT_TYPES[detail.client.type]}</Badge>
              {detail.client.phone && (
                <Badge tone="slate">
                  <Phone size={11} /> <span className="num">{detail.client.phone}</span>
                </Badge>
              )}
              {detail.client.phone2 && (
                <Badge tone="slate">
                  <Phone size={11} /> <span className="num">{detail.client.phone2}</span>
                </Badge>
              )}
              {(detail.stats.debt ?? 0) > 0 && (
                <Badge tone="rose">
                  دين قائم{" "}
                  <span className="num">
                    {formatMoneyJOD(detail.stats.debt ?? 0, currency, rates)}
                  </span>
                </Badge>
              )}
              {detail.stats.lastOrderAt && (
                <Badge tone="mint">
                  آخر طلب <span className="num">{fmtDate(detail.stats.lastOrderAt)}</span>
                </Badge>
              )}
              {isShopClient(detail.client.type) && detail.client.address && (
                 <Badge tone="slate">{detail.client.address}</Badge>
               )}
               {isShopClient(detail.client.type) && detail.client.googleMapsUrl && (
                 <a
                   href={detail.client.googleMapsUrl}
                   target="_blank"
                   rel="noreferrer"
                   className="inline-flex items-center gap-1 text-[11.5px] font-extrabold text-[var(--mint)] hover:underline"
                 >
                   <MapPinned size={12} /> فتح موقع المحل
                 </a>
               )}
               {isShopClient(detail.client.type) && detail.client.distributionMapUrl && (
                 <a
                   href={detail.client.distributionMapUrl}
                   target="_blank"
                   rel="noreferrer"
                   className="inline-flex items-center gap-1 text-[11.5px] font-extrabold text-[var(--mint)] hover:underline"
                 >
                   <MapPinned size={12} /> خريطة التوزيع
                 </a>
               )}

              <span className="me-auto text-[11.5px] font-bold text-[var(--faint)]">
                عميل منذ {fmtDate(detail.client.createdAt)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-[var(--line-soft)] bg-white/[.03] p-4 text-center">
                <div className="num text-[22px] font-black text-[var(--mint)]">{fmtNum(detail.stats.orders)}</div>
                <div className="text-[11.5px] font-bold text-[var(--muted)]">فاتورة مكتملة</div>
              </div>
              <div className="rounded-2xl border border-[var(--line-soft)] bg-white/[.03] p-4 text-center">
                <div className="num text-[22px] font-black text-[var(--mint)]">{formatMoneyJOD(detail.stats.total, currency, rates)}</div>
                <div className="text-[11.5px] font-bold text-[var(--muted)]">إجمالي المشتريات</div>
              </div>
              <div className="rounded-2xl border border-[var(--line-soft)] bg-white/[.03] p-4 text-center">
                <div className="num text-[22px] font-black text-[var(--muted)]">
                  {formatMoneyJOD(detail.stats.avg ?? (detail.stats.orders ? detail.stats.total / detail.stats.orders : 0), currency, rates)}
                </div>
                <div className="text-[11.5px] font-bold text-[var(--muted)]">متوسط الفاتورة</div>
              </div>
              <div className="rounded-2xl border border-[var(--line-soft)] bg-white/[.03] p-4 text-center">
                <div className={cls("num text-[22px] font-black", (detail.stats.debt ?? 0) > 0 ? "text-[var(--danger)]" : "text-[var(--mint)]")}>
                  {formatMoneyJOD(detail.stats.debt ?? 0, currency, rates)}
                </div>
                <div className="text-[11.5px] font-bold text-[var(--muted)]">الرصيد (دين)</div>
              </div>
            </div>

            {detail.purchases.length === 0 ? (
              <Empty icon={<ReceiptIcon />} title="لا توجد مشتريات بعد" />
            ) : (
              <div className="max-h-[380px] space-y-2.5 overflow-y-auto pe-1">
                {detail.purchases.map((p) => (
                  <Link
                    key={p.id}
                    href={`/sales/${p.id}`}
                    className="block rounded-2xl border border-[var(--line-soft)] bg-white/[.02] p-3.5 transition-colors hover:border-[var(--line)] hover:bg-white/[.045]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="num text-[13px] font-black">{invoiceNo(p.id)}</span>
                        {p.status === "cancelled" && <Badge tone="rose">ملغاة</Badge>}
                      </div>
                      <span className={cls("num text-[13.5px] font-black", p.status === "cancelled" ? "text-[var(--faint)] line-through" : "text-[var(--mint)]")}>
                        {formatMoneyJOD(p.total, currency, rates)}
                      </span>
                    </div>
                    <div className="mt-1.5 text-[11px] font-bold text-[var(--faint)]">
                      {fmtDateTime(p.createdAt)} • البائع: {p.userName}
                    </div>
                    <div className="mt-2.5 flex items-center gap-2 overflow-x-auto">
                      {p.items.map((it, j) => (
                        <span key={j} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--line-soft)] bg-white/[.03] px-2 py-1 text-[11px] font-bold">
                          <ProductImage src={it.imageUrl} name={it.productName} size={18} radius={5} />
                          {it.productName}
                          <span className="num text-[var(--mint)]">×{it.quantity}</span>
                        </span>
                      ))}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={doDelete}
        loading={deleting}
        title="حذف العميل"
        message={`سيتم حذف "${deleteTarget?.name}" نهائيًا. العملاء المرتبطون بفواتير لا يمكن حذفهم حفاظًا على السجلات.`}
        confirmText="حذف"
      />
    </div>
  );
}

function ReceiptIcon() {
  return <Users size={17} />;
}
