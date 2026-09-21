"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ArrowRight, Ban, Droplets, Printer } from "lucide-react";
import { api } from "@/lib/client";
import { useToast } from "@/components/toast";
import { Badge, Btn, ConfirmDialog, Skeleton } from "@/components/ui";
import { ProductImage } from "@/components/ProductImage";
import {
  CLIENT_TYPES,
  SHIPPING_TYPES,
  cls,
  fmtDateTime,
  fmtMoney,
  invoiceNo,
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
  const [sale, setSale] = useState<SaleDetailDTO | null>(null);
  const [me, setMe] = useState<SessionUserDTO | null>(null);
  const [error, setError] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

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
                    <span className="num font-bold text-[#33424e]">{fmtMoney(it.price)}</span>
                  </td>
                  <td>
                    <span className="num font-black text-[#14222c]">×{it.quantity}</span>
                  </td>
                  <td style={{ textAlign: "left" }}>
                    <span className="num font-black text-[#c40000]">{fmtMoney(it.lineTotal)}</span>
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
                <span>الإجمالي الفرعي</span>
                <span className="num">{fmtMoney(sale.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>الشحن ({SHIPPING_TYPES[sale.shippingType]})</span>
                <span className="num">{fmtMoney(sale.shippingCost)}</span>
              </div>
              <div
                className="flex items-center justify-between rounded-2xl px-4 py-3 text-[15px] font-black text-white"
                style={{ background: "linear-gradient(135deg,#c40000,#5c0000)" }}
              >
                <span>الإجمالي المستحق</span>
                <span className="num text-[19px]">{fmtMoney(sale.total)}</span>
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
