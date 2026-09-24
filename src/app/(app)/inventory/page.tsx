"use client";

// سجل حركات المخزون — تتبع دخول وخروج كل قطعة:
// بيع / إلغاء فاتورة / مرتجع / استبدال / تسوية يدوية، مع الرصيد بعد كل حركة
// واسم الموظف المنفّذ ورقم المرجع (الفاتورة أو المرتجع) + تصدير Excel.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  Download,
  PackageSearch,
  RefreshCw,
  Scale,
} from "lucide-react";
import { api, downloadXlsx } from "@/lib/client";
import { useToast } from "@/components/toast";
import { Badge, Btn, Card, Empty, Field, Input, Select, Skeleton } from "@/components/ui";
import CurrencySwitcher from "@/components/CurrencySwitcher";
import { useCurrency } from "@/components/useCurrency";
import {
  cls,
  fmtDateTime,
  fmtNum,
  invoiceNo,
  type InventoryMovementDTO,
  type ProductDTO,
} from "@/lib/shared";

const REASON_TONES: Record<string, string> = {
  بيع: "mint",
  "إلغاء فاتورة": "rose",
  مرتجع: "violet",
  استبدال: "sky",
  "تسوية يدوية": "amber",
};

export default function InventoryPage() {
  const toast = useToast();
  const { settings } = useCurrency();
  const [rows, setRows] = useState<InventoryMovementDTO[] | null>(null);
  const [products, setProducts] = useState<ProductDTO[]>([]);
  const [productId, setProductId] = useState("");
  const [direction, setDirection] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (pid = productId, dir = direction, f = from, t = to) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (pid) params.set("productId", pid);
        if (dir) params.set("direction", dir);
        if (f) params.set("from", f);
        if (t) params.set("to", t);
        params.set("limit", "300");
        setRows(
          await api<InventoryMovementDTO[]>(
            `/api/inventory/movements?${params.toString()}`,
          ),
        );
      } catch (e) {
        toast.push("err", e instanceof Error ? e.message : "تعذر تحميل الحركات");
        setRows([]);
      } finally {
        setLoading(false);
      }
    },
    [productId, direction, from, to], // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    api<ProductDTO[]>("/api/products")
      .then(setProducts)
      .catch(() => {});
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    const list = rows ?? [];
    const inQty = list
      .filter((r) => r.direction === "in")
      .reduce((a, r) => a + r.delta, 0);
    const outQty = list
      .filter((r) => r.direction === "out")
      .reduce((a, r) => a + r.delta, 0);
    return { count: list.length, inQty, outQty, net: inQty - outQty };
  }, [rows]);

  function exportExcel() {
    const list = rows ?? [];
    const name = productId
      ? products.find((p) => String(p.id) === productId)?.name ?? "صنف"
      : "كل الأصناف";
    downloadXlsx(`حركة-المخزون-${name}`, [
      {
        name: "حركات المخزون",
        rows: [
          ["الصنف", name],
          ["الفترة", from || to ? `${from || "البداية"} ← ${to || "الآن"}` : "كل الفترات"],
          ["عدد الحركات", list.length],
          ["إجمالي الدخول", stats.inQty],
          ["إجمالي الخروج", stats.outQty],
          ["الصافي", stats.net],
          [],
          [
            "التاريخ",
            "الصنف",
            "النوع",
            "الكمية",
            "الرصيد بعد",
            "السبب",
            "المرجع",
            "المنفّذ",
            "ملاحظة",
          ],
          ...list.map((r) => [
            r.createdAt.slice(0, 19).replace("T", " "),
            r.productName,
            r.direction === "in" ? "دخول" : "خروج",
            r.delta,
            r.stockAfter,
            r.reason,
            r.refId
              ? `${r.refType === "return" ? "مرتجع" : "فاتورة"} ${invoiceNo(r.refId)}`
              : "",
            r.userName,
            r.note,
          ]),
        ],
      },
    ]);
    toast.push("ok", "تم تنزيل سجل حركات المخزون");
  }

  return (
    <div className="space-y-5">
      {/* ===== ملخص ===== */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          icon={<PackageSearch size={17} className="text-white" />}
          tone="violet"
          label="عدد الحركات المسجلة"
          value={fmtNum(stats.count)}
        />
        <Stat
          icon={<ArrowDownToLine size={17} className="text-[var(--mint)]" />}
          tone="mint"
          label="إجمالي الكميات الداخلة"
          value={fmtNum(stats.inQty)}
        />
        <Stat
          icon={<ArrowUpFromLine size={17} className="text-[var(--danger)]" />}
          tone="rose"
          label="إجمالي الكميات الخارجة"
          value={fmtNum(stats.outQty)}
        />
        <Stat
          icon={<Scale size={17} className="text-[var(--amber)]" />}
          tone="amber"
          label="صافي الحركة"
          value={fmtNum(stats.net)}
        />
      </div>

      {/* ===== الفلاتر ===== */}
      <Card className="anim-in anim-d1" bodyClass="flex flex-wrap items-end gap-3 p-4">
        <Field label="الصنف">
          <Select
            value={productId}
            onChange={(e) => {
              setProductId(e.target.value);
              load(e.target.value, direction, from, to);
            }}
            className="!w-auto min-w-[200px]"
          >
            <option value="">كل الأصناف</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="نوع الحركة">
          <Select
            value={direction}
            onChange={(e) => {
              setDirection(e.target.value);
              load(productId, e.target.value, from, to);
            }}
            className="!w-auto"
          >
            <option value="">الكل</option>
            <option value="in">دخول</option>
            <option value="out">خروج</option>
          </Select>
        </Field>
        <Field label="من تاريخ">
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="!w-auto"
          />
        </Field>
        <Field label="إلى تاريخ">
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="!w-auto"
          />
        </Field>
        <Btn variant="primary" size="sm" onClick={() => load()} loading={loading}>
          <RefreshCw size={14} /> تحديث
        </Btn>
        <Btn size="sm" onClick={exportExcel} disabled={!rows?.length}>
          <Download size={14} /> Excel
        </Btn>
        <CurrencySwitcher defaultCurrency={settings?.defaultCurrency} compact />
      </Card>

      {/* ===== السجل ===== */}
      <Card
        className="anim-in anim-d2 overflow-hidden"
        title="سجل حركات المخزون (دخول / خروج)"
        icon={<Boxes size={16} />}
        bodyClass="overflow-x-auto"
      >
        {!rows ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-11" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <Empty
            icon={<Boxes size={22} />}
            title="لا حركات مطابقة"
            hint="تُسجَّل الحركات تلقائيًا مع كل بيع أو إلغاء فاتورة أو مرتجع أو تسوية مخزون"
          />
        ) : (
          <table className="tbl min-w-[860px]">
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>الصنف</th>
                <th>النوع</th>
                <th>الكمية</th>
                <th>الرصيد بعد</th>
                <th>السبب</th>
                <th>المرجع</th>
                <th>المنفّذ</th>
                <th>ملاحظة</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="text-[11.5px] font-bold text-[var(--faint)]">
                    {fmtDateTime(r.createdAt)}
                  </td>
                  <td className="font-extrabold">{r.productName}</td>
                  <td>
                    <Badge tone={r.direction === "in" ? "mint" : "rose"}>
                      {r.direction === "in" ? (
                        <ArrowDownToLine size={11} />
                      ) : (
                        <ArrowUpFromLine size={11} />
                      )}
                      {r.direction === "in" ? "دخول" : "خروج"}
                    </Badge>
                  </td>
                  <td>
                    <span
                      className={cls(
                        "num font-black",
                        r.direction === "in"
                          ? "text-[var(--mint)]"
                          : "text-[var(--danger)]",
                      )}
                    >
                      {r.direction === "in" ? "+" : "−"}
                      {fmtNum(r.delta)}
                    </span>
                  </td>
                  <td>
                    <span className="num font-bold text-[var(--muted)]">
                      {fmtNum(r.stockAfter)}
                    </span>
                  </td>
                  <td>
                    <Badge tone={REASON_TONES[r.reason] ?? "slate"}>{r.reason}</Badge>
                  </td>
                  <td>
                    {r.refId ? (
                      <span className="num text-[11.5px] font-bold text-[var(--muted)]">
                        {r.refType === "return" ? "مرتجع" : "فاتورة"} {invoiceNo(r.refId)}
                      </span>
                    ) : (
                      <span className="text-[11.5px] text-[var(--faint)]">—</span>
                    )}
                  </td>
                  <td className="text-[12px] font-bold text-[var(--muted)]">
                    {r.userName || "—"}
                  </td>
                  <td className="max-w-[180px] truncate text-[11.5px] font-bold text-[var(--faint)]">
                    {r.note || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "mint" | "rose" | "amber" | "violet";
}) {
  const bg: Record<string, string> = {
    mint: "rgba(255,34,34,.12)",
    rose: "rgba(255,43,43,.12)",
    amber: "rgba(255,122,122,.12)",
    violet: "rgba(255,255,255,.1)",
  };
  return (
    <div className="panel anim-in flex items-center gap-3 p-3.5">
      <div className="kpi-icon" style={{ background: bg[tone], width: 38, height: 38 }}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="truncate text-[11px] font-bold text-[var(--faint)]">{label}</div>
        <div className="num truncate text-[15px] font-black">{value}</div>
      </div>
    </div>
  );
}