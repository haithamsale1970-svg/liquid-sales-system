"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
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
  CLIENT_TYPES,
  cls,
  fmtDate,
  fmtDateTime,
  fmtNum,
  invoiceNo,
  type ClientDTO,
  type ClientType,
  type SessionUserDTO,
  type ShippingType,
} from "@/lib/shared";

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
    address: string;
    notes: string;
    createdAt: string;
  };
  stats: { orders: number; total: number };
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

const EMPTY_FORM = { name: "", type: "individual" as ClientType, phone: "", address: "", notes: "" };

export default function ClientsPage() {
  const toast = useToast();
  const { currency, settings, rates } = useCurrency();
  const [me, setMe] = useState<SessionUserDTO | null>(null);
  const [items, setItems] = useState<ClientDTO[] | null>(null);
  const [q, setQ] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ClientDTO | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [detail, setDetail] = useState<ClientDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<ClientDTO | null>(null);
  const [deleting, setDeleting] = useState(false);

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
    return (items ?? []).filter(
      (c) => !n || `${c.name} ${c.phone}`.toLowerCase().includes(n),
    );
  }, [items, q]);

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

  function openCreate() {
    if (me && me.role !== "admin") return;
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEdit(c: ClientDTO) {
    if (me && me.role !== "admin") return;
    setEditing(c);
    setForm({ name: c.name, type: c.type, phone: c.phone, address: c.address, notes: c.notes });
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
        <div className="relative min-w-[220px] flex-1">
          <input
            className="inp ps-10"
            placeholder="ابحث بالاسم أو الهاتف…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Search size={16} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
        </div>
      {me?.role === "admin" && (
        <Btn variant="primary" size="sm" onClick={openCreate}>
          <Plus size={15} /> إضافة عميل
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
            hint="أضف عملاءك (محلات / شركات / أفراد) لربطهم بالفواتير"
            action={
              <Btn variant="primary" size="sm" onClick={openCreate}>
                <Plus size={15} /> إضافة عميل
              </Btn>
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
                      <span className="num text-[12.5px] font-bold text-[var(--muted)]">{c.phone || "—"}</span>
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
                        {me?.role === "admin" && (
                          <button className="icon-btn" title="تعديل" onClick={() => openEdit(c)}>
                            <Pencil size={14} />
                          </button>
                        )}
                        {me?.role === "admin" && (
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
          <Field label="اسم العميل *">
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="محل النخبة / أحمد سامي…" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="نوع العميل">
              <Select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as ClientType }))}>
                <option value="store">محل</option>
                <option value="company">شركة</option>
                <option value="individual">فرد</option>
              </Select>
            </Field>
            <Field label="رقم الهاتف">
              <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="01xxxxxxxxx" dir="ltr" className="num" />
            </Field>
          </div>
          <Field label="العنوان">
            <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="المحافظة — المنطقة — الشارع" />
          </Field>
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
              {detail.client.address && <Badge tone="slate">{detail.client.address}</Badge>}
              <span className="me-auto text-[11.5px] font-bold text-[var(--faint)]">
                عميل منذ {fmtDate(detail.client.createdAt)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-[var(--line-soft)] bg-white/[.03] p-4 text-center">
                <div className="num text-[22px] font-black text-[var(--mint)]">{fmtNum(detail.stats.orders)}</div>
                <div className="text-[11.5px] font-bold text-[var(--muted)]">فاتورة مكتملة</div>
              </div>
              <div className="rounded-2xl border border-[var(--line-soft)] bg-white/[.03] p-4 text-center">
                <div className="num text-[22px] font-black text-[var(--mint)]">{formatMoneyJOD(detail.stats.total, currency, rates)}</div>
                <div className="text-[11.5px] font-bold text-[var(--muted)]">إجمالي المشتريات</div>
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
