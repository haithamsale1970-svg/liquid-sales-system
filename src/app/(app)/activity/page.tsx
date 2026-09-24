"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, ScrollText, Search } from "lucide-react";
import { api } from "@/lib/client";
import { useToast } from "@/components/toast";
import { Badge, Btn, Card, Empty, Input, Select, Skeleton } from "@/components/ui";
import { fmtDateTime, fmtNum, relTime, type ActivityDTO } from "@/lib/shared";

const ENTITY_TONES: Record<string, string> = {
  منتج: "mint",
  عميل: "violet",
  فاتورة: "amber",
  مستخدم: "rose",
  نظام: "slate",
  دخول: "sky",
  ديون: "rose",
  مصروف: "amber",
  مرتجع: "violet",
  مخزون: "mint",
};
const ENTITIES = ["", "منتج", "عميل", "فاتورة", "مستخدم", "دخول", "نظام", "ديون", "مصروف", "مرتجع", "مخزون"];

type ActivitySummary = {
  userId: number | null;
  userName: string;
  total: number;
  invoices: number;
  collections: number;
  returns: number;
  expenses: number;
  clients: number;
  inventory: number;
  products: number;
  lastAt: string | null;
};

type ActivityResponse = { summary: ActivitySummary[]; items: ActivityDTO[] };

export default function ActivityPage() {
  const toast = useToast();
  const [rows, setRows] = useState<ActivityDTO[] | null>(null);
  const [summary, setSummary] = useState<ActivitySummary[]>([]);
  const [entity, setEntity] = useState("");
  const [q, setQ] = useState("");
  const [userId, setUserId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [users, setUsers] = useState<Array<{ id: number; name: string }>>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (e = entity, s = q) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (e) params.set("entity", e);
        if (s.trim()) params.set("q", s.trim());
        if (userId) params.set("userId", userId);
        if (from) params.set("from", from);
        if (to) params.set("to", to);
        params.set("limit", "200");
        const result = await api<ActivityResponse>(`/api/activity?${params.toString()}`);
        setRows(result.items);
        setSummary(result.summary);
      } catch (err) {
        toast.push("err", err instanceof Error ? err.message : "تعذر التحميل");
        setRows([]);
      } finally {
        setLoading(false);
      }
    },
    [entity, q, userId, from, to], // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    load();
    api<Array<{ id: number; name: string }>>("/api/users")
      .then(setUsers)
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-5">
      <div className="anim-in flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[220px] flex-1">
          <input
            className="inp ps-10"
            placeholder="ابحث في التفاصيل أو باسم المستخدم…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
          <Search size={16} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
        </div>
        <Select
          value={entity}
          onChange={(e) => {
            setEntity(e.target.value);
            load(e.target.value, q);
          }}
          className="!w-auto"
        >
          {ENTITIES.map((e) => (
            <option key={e} value={e}>
              {e || "كل الأنواع"}
            </option>
          ))}
        </Select>
        <Select
          value={userId}
          onChange={(e) => {
            setUserId(e.target.value);
            load(entity, q);
          }}
          className="!w-auto min-w-[130px]"
        >
          <option value="">كل المستخدمين</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </Select>
        <Input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          onBlur={() => load()}
          className="!w-auto"
        />
        <span className="text-[12px] font-bold text-[var(--faint)]">إلى</span>
        <Input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          onBlur={() => load()}
          className="!w-auto"
        />
        <Btn variant="primary" size="sm" onClick={() => load()} loading={loading}>
          <RefreshCw size={14} /> تحديث
        </Btn>
      </div>

      {summary.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {summary.slice(0, 8).map((s) => (
            <Card key={`${s.userId ?? "system"}-${s.userName}`} className="p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-extrabold">{s.userName}</span>
                <Badge tone="slate">{fmtNum(s.total)} حركة</Badge>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[10.5px] font-bold text-[var(--muted)]">
                <span>فواتير<br /><b className="text-[var(--mint)]">{s.invoices}</b></span>
                <span>تحصيل<br /><b className="text-[var(--mint)]">{s.collections}</b></span>
                <span>مرتجع<br /><b className="text-[var(--violet)]">{s.returns}</b></span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card className="anim-in anim-d1" title="كل الحركات المسجلة" icon={<ScrollText size={16} />} bodyClass="p-2">
        {!rows ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-11" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <Empty icon={<ScrollText size={22} />} title="لا يوجد نشاط مطابق" hint="جرّب توسيع البحث" />
        ) : (
          <ul className="divide-y divide-[var(--line-soft)]">
            {rows.map((a) => (
              <li key={a.id} className="flex items-start gap-3 px-3 py-3">
                <Badge tone={ENTITY_TONES[a.entity] ?? "slate"} className="mt-0.5 w-[62px] shrink-0 justify-center">
                  {a.entity}
                </Badge>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold leading-6">{a.details || a.action}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] font-bold text-[var(--faint)]">
                    <span className="text-[var(--muted)]">{a.userName}</span>
                    <span>•</span>
                    <span title={fmtDateTime(a.createdAt)}>{relTime(a.createdAt)}</span>
                    <span className="num hidden sm:inline">• {fmtDateTime(a.createdAt)}</span>
                  </div>
                </div>
                <span className="shrink-0 rounded-lg bg-white/[.04] px-2.5 py-1 text-[11px] font-extrabold text-[var(--muted)]">
                  {a.action}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
