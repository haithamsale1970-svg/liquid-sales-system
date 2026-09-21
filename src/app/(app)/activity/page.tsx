"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, ScrollText, Search, ShieldCheck } from "lucide-react";
import { api } from "@/lib/client";
import { useToast } from "@/components/toast";
import { Badge, Btn, Card, Empty, Input, Select, Skeleton } from "@/components/ui";
import { fmtDateTime, relTime, type ActivityDTO } from "@/lib/shared";

const ENTITY_TONES: Record<string, string> = {
  منتج: "mint",
  عميل: "violet",
  فاتورة: "amber",
  مستخدم: "rose",
  نظام: "slate",
  دخول: "sky",
};
const ENTITIES = ["", "منتج", "عميل", "فاتورة", "مستخدم", "دخول", "نظام"];

export default function ActivityPage() {
  const toast = useToast();
  const [rows, setRows] = useState<ActivityDTO[] | null>(null);
  const [entity, setEntity] = useState("");
  const [q, setQ] = useState("");
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (e = entity, s = q) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (e) params.set("entity", e);
        if (s.trim()) params.set("q", s.trim());
        params.set("limit", "200");
        setRows(await api<ActivityDTO[]>(`/api/activity?${params.toString()}`));
      } catch (err) {
        if (err instanceof Error && err.message.includes("المدير")) setForbidden(true);
        else toast.push("err", err instanceof Error ? err.message : "تعذر التحميل");
        setRows([]);
      } finally {
        setLoading(false);
      }
    },
    [entity, q], // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (forbidden) {
    return (
      <Card>
        <Empty
          icon={<ShieldCheck size={22} />}
          title="سجل النشاط للمدير فقط"
          hint="يتتبع السجل كل حركة بالنظام واسم من قام بها"
        />
      </Card>
    );
  }

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
        <Btn variant="primary" size="sm" onClick={() => load()} loading={loading}>
          <RefreshCw size={14} /> تحديث
        </Btn>
      </div>

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
