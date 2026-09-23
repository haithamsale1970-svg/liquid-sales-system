"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FilterX,
  Plus,
  ReceiptText,
} from "lucide-react";
import { api } from "@/lib/client";
import { useToast } from "@/components/toast";
import { Badge, Btn, Card, Empty, Input, Select, Skeleton } from "@/components/ui";
import CurrencySwitcher from "@/components/CurrencySwitcher";
import { useCurrency } from "@/components/useCurrency";
import { formatMoneyJOD } from "@/lib/currency";
import {
  SHIPPING_TYPES,
  cls,
  fmtDateTime,
  fmtNum,
  invoiceNo,
  type ClientDTO,
  type SaleListDTO,
  type SessionUserDTO,
} from "@/lib/shared";

type SalesResponse = {
  data: SaleListDTO[];
  page: number;
  pages: number;
  totalCount: number;
};

export default function SalesPage() {
  const toast = useToast();
  const { currency, settings, rates } = useCurrency();
  const [me, setMe] = useState<SessionUserDTO | null>(null);
  const [res, setRes] = useState<SalesResponse | null>(null);
  const [clients, setClients] = useState<ClientDTO[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [clientId, setClientId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (p = page) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (from) params.set("from", from);
        if (to) params.set("to", to);
        if (clientId) params.set("clientId", clientId);
        if (status) params.set("status", status);
        params.set("page", String(p));
        setRes(await api<SalesResponse>(`/api/sales?${params.toString()}`));
      } catch (e) {
        toast.push("err", e instanceof Error ? e.message : "تعذر التحميل");
      } finally {
        setLoading(false);
      }
    },
    [page, from, to, clientId, status], // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    api<ClientDTO[]>("/api/clients").then(setClients).catch(() => {});
    api<SessionUserDTO>("/api/auth/me").then(setMe).catch(() => {});
  }, []);

  useEffect(() => {
    load(page);
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  function applyFilters() {
    setPage(1);
    load(1);
  }

  function resetFilters() {
    setFrom("");
    setTo("");
    setClientId("");
    setStatus("");
    setPage(1);
    setTimeout(() => load(1), 0);
  }

  return (
    <div className="space-y-5">
      {/* filters */}
      <div className="anim-in flex flex-wrap items-end gap-2.5">
        <div>
          <label className="lbl">من تاريخ</label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="!w-auto" />
        </div>
        <div>
          <label className="lbl">إلى تاريخ</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="!w-auto" />
        </div>
        <div>
          <label className="lbl">العميل</label>
          <Select value={clientId} onChange={(e) => setClientId(e.target.value)} className="!w-auto min-w-[150px]">
            <option value="">كل العملاء</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className="lbl">الحالة</label>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="!w-auto">
            <option value="">الكل</option>
            <option value="completed">مكتملة</option>
            <option value="cancelled">ملغاة</option>
          </Select>
        </div>
        <Btn variant="primary" size="sm" onClick={applyFilters} loading={loading}>
          تصفية
        </Btn>
        <Btn size="sm" onClick={resetFilters}>
          <FilterX size={14} /> مسح
        </Btn>
        <Link href="/sales/new" className="btn btn-primary btn-sm ms-auto">
          <Plus size={15} /> فاتورة جديدة
        </Link>
        <CurrencySwitcher defaultCurrency={settings?.defaultCurrency} compact />
      </div>

      <Card
        className="anim-in anim-d1 overflow-hidden"
        bodyClass="overflow-x-auto"
        title={res ? `${fmtNum(res.totalCount)} فاتورة` : "الفواتير"}
        icon={<ReceiptText size={16} />}
      >
        {!res ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : res.data.length === 0 ? (
          <Empty
            icon={<ReceiptText size={22} />}
            title="لا توجد فواتير مطابقة"
            hint="جرّب تعديل الفلاتر أو أنشئ فاتورة جديدة"
            action={
              <Link href="/sales/new" className="btn btn-primary btn-sm">
                <Plus size={14} /> فاتورة جديدة
              </Link>
            }
          />
        ) : (
          <table className="tbl min-w-[860px]">
            <thead>
              <tr>
                <th>رقم الفاتورة</th>
                <th>العميل</th>
                <th>الأصناف</th>
                <th>الشحن</th>
                <th>الإجمالي ({currency})</th>
                {me?.role === "admin" && <th>الربح</th>}
                <th>البائع</th>
                <th>الحالة</th>
                <th>التاريخ</th>
              </tr>
            </thead>
            <tbody className={cls(loading && "opacity-50 transition-opacity")}>
              {res.data.map((s) => (
                <tr key={s.id} className="cursor-pointer" onClick={() => (window.location.href = `/sales/${s.id}`)}>
                  <td>
                    <span className="num font-black text-[var(--mint)]">{invoiceNo(s.id)}</span>
                  </td>
                  <td className="font-extrabold">{s.clientName}</td>
                  <td>
                    <span className="num text-[12.5px] font-bold text-[var(--muted)]">
                      {fmtNum(s.itemsCount)} صنف / {fmtNum(s.unitsCount)} قطعة
                    </span>
                  </td>
                  <td>
                    {s.shippingType === "none" ? (
                      <span className="text-[12px] font-bold text-[var(--faint)]">—</span>
                    ) : (
                      <Badge tone={s.shippingType === "internal" ? "sky" : "violet"}>
                        {SHIPPING_TYPES[s.shippingType]} <span className="num">{formatMoneyJOD(s.shippingCost, currency, rates)}</span>
                      </Badge>
                    )}
                  </td>
                  <td>
                    <span className={cls("num font-black", s.status === "cancelled" && "text-[var(--faint)] line-through")}>
                      {formatMoneyJOD(s.total, currency, rates)}
                    </span>
                  </td>
                  {me?.role === "admin" && (
                    <td>
                      <span className="num text-[12.5px] font-bold text-[var(--amber)]">{formatMoneyJOD(s.profit, currency, rates)}</span>
                    </td>
                  )}
                  <td>
                    <span className="text-[12.5px] font-bold text-[var(--muted)]">{s.userName}</span>
                  </td>
                  <td>
                    {s.status === "completed" ? <Badge tone="mint">مكتملة</Badge> : <Badge tone="rose">ملغاة</Badge>}
                  </td>
                  <td>
                    <span className="text-[12px] font-bold text-[var(--faint)]">{fmtDateTime(s.createdAt)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {res && res.pages > 1 && (
        <div className="anim-in flex items-center justify-center gap-3">
          <Btn size="sm" disabled={page >= res.pages} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight size={15} /> الأقدم
          </Btn>
          <span className="num text-[12.5px] font-bold text-[var(--muted)]">
            صفحة {fmtNum(res.page)} من {fmtNum(res.pages)}
          </span>
          <Btn size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            الأحدث <ChevronLeft size={15} />
          </Btn>
        </div>
      )}
    </div>
  );
}
