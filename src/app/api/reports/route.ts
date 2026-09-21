import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { clients, saleItems, sales } from "@/db/schema";
import { errResponse, isErr, num, ok, requireUser } from "@/lib/api";

export const dynamic = "force-dynamic";

function ymd(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function dayStart(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export async function GET(req: Request) {
  const auth = await requireUser();
  if (isErr(auth)) return auth.res;

  const url = new URL(req.url);
  const now = new Date();
  let from = new Date(url.searchParams.get("from") ?? "");
  let to = new Date(url.searchParams.get("to") ?? "");
  if (isNaN(from.getTime())) {
    from = new Date(now);
    from.setDate(from.getDate() - 29);
  }
  if (isNaN(to.getTime())) to = now;
  from = dayStart(from);
  to = dayStart(to);
  const endExclusive = new Date(to);
  endExclusive.setDate(endExclusive.getDate() + 1);

  // guard: max 366 days
  if (endExclusive.getTime() - from.getTime() > 366 * 24 * 3600 * 1000) {
    from = new Date(endExclusive);
    from.setDate(from.getDate() - 366);
  }

  const cond = and(
    eq(sales.status, "completed"),
    gte(sales.createdAt, from),
    lt(sales.createdAt, endExclusive),
  );

  try {
    const totalsRows = await db
      .select({
        total: sql<string>`coalesce(sum(${sales.total}), 0)`,
        profit: sql<string>`coalesce(sum(${sales.profit}), 0)`,
        shipping: sql<string>`coalesce(sum(${sales.shippingCost}), 0)`,
        count: sql<number>`count(*)::int`,
      })
      .from(sales)
      .where(cond);

    const seriesRows = await db
      .select({
        d: sql<string>`to_char(${sales.createdAt}, 'YYYY-MM-DD')`,
        total: sql<string>`coalesce(sum(${sales.total}), 0)`,
        count: sql<number>`count(*)::int`,
      })
      .from(sales)
      .where(cond)
      .groupBy(sql`to_char(${sales.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${sales.createdAt}, 'YYYY-MM-DD')`);

    const byDay = new Map(seriesRows.map((r) => [r.d, r]));
    const series: Array<{ date: string; total: number; count: number }> = [];
    for (let d = new Date(from); d < endExclusive; d.setDate(d.getDate() + 1)) {
      const key = ymd(d);
      const row = byDay.get(key);
      series.push({
        date: key,
        total: row ? parseFloat(row.total) : 0,
        count: row ? row.count : 0,
      });
    }

    const unitsRow = await db
      .select({
        units: sql<number>`coalesce(sum(${saleItems.quantity}), 0)::int`,
      })
      .from(saleItems)
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .where(cond);

    const [topProducts, topClients] = await Promise.all([
      db
        .select({
          productId: saleItems.productId,
          name: saleItems.productName,
          imageUrl: saleItems.imageUrl,
          qty: sql<number>`coalesce(sum(${saleItems.quantity}), 0)::int`,
          revenue: sql<string>`coalesce(sum(${saleItems.lineTotal}), 0)`,
          profit: sql<string>`coalesce(sum((${saleItems.price} - ${saleItems.cost}) * ${saleItems.quantity}), 0)`,
        })
        .from(saleItems)
        .innerJoin(sales, eq(saleItems.saleId, sales.id))
        .where(cond)
        .groupBy(saleItems.productId, saleItems.productName, saleItems.imageUrl)
        .orderBy(desc(sql`sum(${saleItems.quantity})`))
        .limit(10),
      db
        .select({
          clientId: clients.id,
          name: clients.name,
          type: clients.type,
          orders: sql<number>`count(*)::int`,
          revenue: sql<string>`coalesce(sum(${sales.total}), 0)`,
        })
        .from(sales)
        .innerJoin(clients, eq(sales.clientId, clients.id))
        .where(cond)
        .groupBy(clients.id)
        .orderBy(desc(sql`sum(${sales.total})`))
        .limit(10),
    ]);

    const total = num(totalsRows[0]?.total);
    const count = totalsRows[0]?.count ?? 0;

    return ok({
      range: { from: ymd(from), to: ymd(to) },
      totals: {
        total,
        profit: num(totalsRows[0]?.profit),
        shipping: num(totalsRows[0]?.shipping),
        count,
        avg: count ? total / count : 0,
        units: unitsRow[0]?.units ?? 0,
      },
      series,
      topProducts: topProducts.map((p) => ({
        ...p,
        revenue: parseFloat(p.revenue),
        profit: parseFloat(p.profit),
      })),
      topClients: topClients.map((c) => ({
        ...c,
        revenue: parseFloat(c.revenue),
      })),
    });
  } catch (e) {
    return errResponse(e);
  }
}
