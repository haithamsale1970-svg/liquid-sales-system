"use client";

import { t } from "@/lib/i18n";

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
    async (pid = productId, dir = direction, f = from, toDate = to) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (pid) params.set("productId", pid);
        if (dir) params.set("direction", dir);
        if (f) params.set("from", f);
        if (toDate) params.set("to", toDate);
        params.set("limit", "300");
        setRows(
          await api<InventoryMovementDTO[]>(
            `/api/inventory/movements?${params.toString()}`,
          ),
        );
      } catch (e) {
        toast.push("err", e instanceof Error ? e.message : t("تعذر تحميل الحركات"));
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
      ? products.find((p) => String(p.id) === productId)?.name ?? t("صنف")
      : t("كل الأصناف");
    downloadXlsx(`${t("حركة-المخزون-")}${name}`, [
      {
        name: t("حركات المخزون"),
        rows: [
          [t("الصنف"), name],
          [t("الفترة"), from || to ? `${from || t("البداية")} ← ${to || t("الآن")}` : t("كل الفترات")],
          [t("عدد الحركات"), list.length],
          [t("إجمالي الدخول"), stats.inQty],
          [t("إجمالي الخروج"), stats.outQty],
          [t("الصافي"), stats.net],
          [],
          [
            t("التاريخ"),
            t("الصنف"),
            t("الحجم"),
            t("النيكوتين"),
            t("نوع السعر"),
            t("النوع"),
            t("الكمية"),
            t("الرصيد بعد"),
            t("السبب"),
            t("المرجع"),
            t("المنفّذ"),
            t("ملاحظة"),
          ],
          ...list.map((r) => [
            r.createdAt.slice(0, 19).replace("T", " "),
            r.productName,
            r.size,
            r.nicotine,
            r.priceType === "wholesale" ? t("جملة") : t("أفراد"),
            r.direction === "in" ? t("دخول") : t("خروج"),
            r.delta,
            r.stockAfter,
            r.reason,
            r.refId
              ? `${r.refType === "return" ? t("مرتجع") : t("فاتورة")} ${invoiceNo(r.refId)}`
              : "",
            r.userName,
            r.note,
          ]),
        ],
      },
    ]);
    toast.push("ok", t("تم تنزيل سجل حركات المخزون"));
  }

  return (
    <div className="space-y-5">
      {/* ===== ملخص ===== */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          icon={<PackageSearch size={17} className="text-[var(--text)]" />}
          tone="violet"
          label={t("عدد الحركات المسجلة")}
          value={fmtNum(stats.count)}
        />
        <Stat
          icon={<ArrowDownToLine size={17} className="text-[var(--mint)]" />}
          tone="mint"
          label={t("إجمالي الكميات الداخلة")}
          value={fmtNum(stats.inQty)}
        />
        <Stat
          icon={<ArrowUpFromLine size={17} className="text-[var(--danger)]" />}
          tone="rose"
          label={t("إجمالي الكميات الخارجة")}
          value={fmtNum(stats.outQty)}
        />
        <Stat
          icon={<Scale size={17} className="text-[var(--amber)]" />}
          tone="amber"
          label={t("صافي الحركة")}
          value={fmtNum(stats.net)}
        />
      </div>

      {/* ===== الفلاتر ===== */}
      <Card className="anim-in anim-d1" bodyClass="flex flex-wrap items-end gap-3 p-4">
        <Field label={t("الصنف")}>
          <Select
            value={productId}
            onChange={(e) => {
              setProductId(e.target.value);
              load(e.target.value, direction, from, to);
            }}
            className="!w-auto min-w-[200px]"
          >
            <option value="">{t("كل الأصناف")}</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("نوع الحركة")}>
          <Select
            value={direction}
            onChange={(e) => {
              setDirection(e.target.value);
              load(productId, e.target.value, from, to);
            }}
            className="!w-auto"
          >
            <option value="">{t("الكل")}</option>
            <option value="in">{t("دخول")}</option>
            <option value="out">{t("خروج")}</option>
          </Select>
        </Field>
        <Field label={t("من تاريخ")}>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="!w-auto"
          />
        </Field>
        <Field label={t("إلى تاريخ")}>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="!w-auto"
          />
        </Field>
        <Btn variant="primary" size="sm" onClick={() => load()} loading={loading}>
          <RefreshCw size={14} /> {t("تحديث")}
        </Btn>
        <Btn size="sm" onClick={exportExcel} disabled={!rows?.length}>
          <Download size={14} /> Excel
        </Btn>
        <CurrencySwitcher defaultCurrency={settings?.defaultCurrency} compact />
      </Card>

      {/* ===== السجل ===== */}
      <Card
        className="anim-in anim-d2 overflow-hidden"
        title={t("سجل حركات المخزون (دخول / خروج)")}
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
            title={t("لا حركات مطابقة")}
            hint={t("تُسجَّل الحركات تلقائيًا مع كل بيع أو إلغاء فاتورة أو مرتجع أو تسوية مخزون")}
          />
        ) : (
          <table className="tbl min-w-[860px]">
            <thead>
              <tr>
                <th>{t("التاريخ")}</th>
                <th>{t("الصنف")}</th>
                <th>{t("المقاس / النيكوتين")}</th>
                <th>{t("النوع")}</th>
                <th>{t("الكمية")}</th>
                <th>{t("الرصيد بعد")}</th>
                <th>{t("السبب")}</th>
                <th>{t("المرجع")}</th>
                <th>{t("المنفّذ")}</th>
                <th>{t("ملاحظة")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="text-[11.5px] font-bold text-[var(--faint)]">
                    {fmtDateTime(r.createdAt)}
                  </td>
                  <td>
                    <div className="font-extrabold">{r.productName}</div>
                    {r.size && (
                      <div className="mt-0.5 text-[10px] font-bold text-[var(--faint)]">
                        {r.size} • {r.nicotine} • {r.priceType === "wholesale" ? t("جملة") : t("أفراد")}
                      </div>
                    )}
                  </td>
                  <td>
                    <Badge tone={r.direction === "in" ? "mint" : "rose"}>
                      {r.direction === "in" ? (
                        <ArrowDownToLine size={11} />
                      ) : (
                        <ArrowUpFromLine size={11} />
                      )}
                      {r.direction === "in" ? t("دخول") : t("خروج")}
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
                        {r.refType === "return" ? t("مرتجع") : t("فاتورة")} {invoiceNo(r.refId)}
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
    mint: "var(--accent-soft)",
    rose: "var(--critical-soft)",
    amber: "var(--alert-soft)",
    violet: "var(--overlay-2)",
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