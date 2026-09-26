import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { activityLogs, clients, products, saleItems, sales, users } from "@/db/schema";
import { errResponse, isErr, num, ok, requirePermission } from "@/lib/api";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

function ymd(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export async function GET() {
  const auth = await requirePermission("dashboard.view");
  if (isErr(auth)) return auth.res;
  // البيانات المالية تظهر فقط لمن يملك الصلاحية المناسبة.
  const isAdmin = can(auth.user, "finances.view_profit");

  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(dayStart);
  yesterday.setDate(yesterday.getDate() - 1);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const seriesStart = new Date(dayStart);
  seriesStart.setDate(seriesStart.getDate() - 13);
  const topStart = new Date(dayStart);
  topStart.setDate(topStart.getDate() - 30);

  try {
    const [todayRows, yesterdayRows, monthRows, stockRows, clientsRows] =
      await Promise.all([
        db
          .select({
            total: sql<string>`coalesce(sum(${sales.total}), 0)`,
            count: sql<number>`count(*)::int`,
          })
          .from(sales)
          .where(and(eq(sales.status, "completed"), gte(sales.createdAt, dayStart))),
        db
          .select({ total: sql<string>`coalesce(sum(${sales.total}), 0)` })
          .from(sales)
          .where(
            and(
              eq(sales.status, "completed"),
              gte(sales.createdAt, yesterday),
              lt(sales.createdAt, dayStart),
            ),
          ),
        db
          .select({
            total: sql<string>`coalesce(sum(${sales.total}), 0)`,
            profit: sql<string>`coalesce(sum(${sales.profit}), 0)`,
            count: sql<number>`count(*)::int`,
          })
          .from(sales)
          .where(and(eq(sales.status, "completed"), gte(sales.createdAt, monthStart))),
        db
          .select({
            units: sql<number>`coalesce(sum(${products.stock}), 0)::int`,
            active: sql<number>`count(*) filter (where not ${products.archived})::int`,
            low: sql<number>`count(*) filter (where not ${products.archived} and ${products.stock} <= ${products.lowStockAt})::int`,
          })
          .from(products),
        db.select({ count: sql<number>`count(*)::int` }).from(clients),
      ]);

    const seriesRows = await db
      .select({
        d: sql<string>`to_char(${sales.createdAt}, 'YYYY-MM-DD')`,
        total: sql<string>`coalesce(sum(${sales.total}), 0)`,
        count: sql<number>`count(*)::int`,
      })
      .from(sales)
      .where(and(eq(sales.status, "completed"), gte(sales.createdAt, seriesStart)))
      .groupBy(sql`to_char(${sales.createdAt}, 'YYYY-MM-DD')`);

    const byDay = new Map(seriesRows.map((r) => [r.d, r]));
    const series: Array<{ date: string; total: number; count: number }> = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(dayStart);
      d.setDate(d.getDate() - 13 + i);
      const key = ymd(d);
      const row = byDay.get(key);
      series.push({
        date: key,
        total: row ? parseFloat(row.total) : 0,
        count: row ? row.count : 0,
      });
    }

    const [lowStock, recentSales, recentActivity, topProducts] =
      await Promise.all([
        db
          .select({
            id: products.id,
            name: products.name,
            stock: products.stock,
            lowStockAt: products.lowStockAt,
            imageUrl: products.imageUrl,
          })
          .from(products)
          .where(
            and(
              eq(products.archived, false),
              sql`${products.stock} <= ${products.lowStockAt}`,
            ),
          )
          .orderBy(asc(products.stock))
          .limit(8),
        db
          .select({
            id: sales.id,
            total: sales.total,
            status: sales.status,
            createdAt: sales.createdAt,
            clientName: clients.name,
          })
          .from(sales)
          .innerJoin(clients, eq(sales.clientId, clients.id))
          .orderBy(desc(sales.createdAt))
          .limit(6),
        db
          .select()
          .from(activityLogs)
          .orderBy(desc(activityLogs.createdAt))
          .limit(8),
        db
          .select({
            productId: saleItems.productId,
            name: saleItems.productName,
            imageUrl: saleItems.imageUrl,
            qty: sql<number>`coalesce(sum(${saleItems.quantity}), 0)::int`,
            revenue: sql<string>`coalesce(sum(${saleItems.lineTotal}), 0)`,
          })
          .from(saleItems)
          .innerJoin(sales, eq(saleItems.saleId, sales.id))
          .where(
            and(eq(sales.status, "completed"), gte(sales.createdAt, topStart)),
          )
          .groupBy(saleItems.productId, saleItems.productName, saleItems.imageUrl)
          .orderBy(desc(sql`sum(${saleItems.quantity})`))
          .limit(5),
      ]);

    return ok({
      kpis: {
        todayTotal: num(todayRows[0]?.total),
        todayCount: todayRows[0]?.count ?? 0,
        yesterdayTotal: num(yesterdayRows[0]?.total),
        monthTotal: num(monthRows[0]?.total),
        // صافي الربح للأدمن فقط — المستخدم العادي يرى إجمالي المبيعات والمخزون.
        monthProfit: isAdmin ? num(monthRows[0]?.profit) : 0,
        monthCount: monthRows[0]?.count ?? 0,
        totalUnits: stockRows[0]?.units ?? 0,
        activeProducts: stockRows[0]?.active ?? 0,
        lowCount: stockRows[0]?.low ?? 0,
        clientsCount: clientsRows[0]?.count ?? 0,
      },
      series,
      lowStock,
      recentSales: recentSales.map((r) => ({
        id: r.id,
        total: num(r.total),
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        clientName: r.clientName,
      })),
      // سجل النشاط الأخير للأدمن فقط.
      recentActivity: isAdmin
        ? recentActivity.map((a) => ({
            id: a.id,
            userName: a.userName,
            action: a.action,
            entity: a.entity,
            entityId: a.entityId,
            details: a.details,
            createdAt: a.createdAt.toISOString(),
          }))
        : [],
      topProducts: topProducts.map((t) => ({
        ...t,
        revenue: parseFloat(t.revenue),
      })),
    });
  } catch (e) {
    return errResponse(e);
  }
}
