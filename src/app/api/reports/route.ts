import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { clients, clientPayments, expenses, returnItems, returns, saleItems, sales, users } from "@/db/schema";
import { errResponse, isErr, num, ok, requirePermission } from "@/lib/api";
import { can } from "@/lib/permissions";
import { isPaymentMethod, type PaymentMethod } from "@/lib/shared";
import { ensureSchema } from "@/lib/migrate";

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
  const auth = await requirePermission("reports.view");
  if (isErr(auth)) return auth.res;
  // التقارير المالية الكاملة لمن يملك صلاحية الأرباح والتكاليف.
  const isAdmin = can(auth.user, "finances.view_profit");
  await ensureSchema();

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
        discount: sql<string>`coalesce(sum(${sales.discount}), 0)`,
        unpaid: sql<string>`coalesce(sum(${sales.total} - coalesce(${sales.paid}, ${sales.total})), 0)`,
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

    const returnTotalsRows = await db
      .select({
        refund: sql<string>`coalesce(sum(${returns.refund}), 0)`,
        count: sql<number>`count(*)::int`,
      })
      .from(returns)
      .where(
        and(
          gte(returns.createdAt, from),
          lt(returns.createdAt, endExclusive),
        ),
      );
    const returnProfitRows = await db
      .select({
        profit: sql<string>`coalesce(sum(case when ${returnItems.direction} = 'in' then -1 else 1 end * (${returnItems.price} - ${returnItems.cost}) * ${returnItems.quantity}), 0)`,
      })
      .from(returnItems)
      .innerJoin(returns, eq(returnItems.returnId, returns.id))
      .where(
        and(
          gte(returns.createdAt, from),
          lt(returns.createdAt, endExclusive),
        ),
      );
    const returnTotal = num(returnTotalsRows[0]?.refund);
    const returnProfit = num(returnProfitRows[0]?.profit);
    const grossProfit = num(totalsRows[0]?.profit);
    const total = Math.max(0, num(totalsRows[0]?.total) - returnTotal);
    const netProfitBeforeExpenses = grossProfit + returnProfit;

    // تفصيل طرق الدفع + المصاريف + أرباح الموظفين (الأرباح للأدمن فقط).
    const returnByMethodRows = await db
      .select({
        method: returns.method,
        refund: sql<string>`coalesce(sum(${returns.refund}), 0)`,
      })
      .from(returns)
      .where(
        and(
          gte(returns.createdAt, from),
          lt(returns.createdAt, endExclusive),
        ),
      )
      .groupBy(returns.method);
    const returnByMethod = new Map<string, number>(
      returnByMethodRows.map(
        (r): [string, number] => [String(r.method), num(r.refund)],
      ),
    );
    const byPaymentRows = await db
      .select({
        method: sales.paymentMethod,
        count: sql<number>`count(*)::int`,
        total: sql<string>`coalesce(sum(${sales.total}), 0)`,
        unpaid: sql<string>`coalesce(sum(${sales.total} - coalesce(${sales.paid}, ${sales.total})), 0)`,
      })
      .from(sales)
      .where(cond)
      .groupBy(sales.paymentMethod)
      .orderBy(desc(sql`sum(${sales.total})`));
    const expenseRows = await db
      .select({ amount: sql<string>`coalesce(sum(${expenses.amount}), 0)` })
      .from(expenses)
      .where(
        and(gte(expenses.createdAt, from), lt(expenses.createdAt, endExclusive)),
      );

    const byEmployeeRows = isAdmin
      ? await db
          .select({
            userId: sales.userId,
            name: users.name,
            orders: sql<number>`count(*)::int`,
            revenue: sql<string>`coalesce(sum(${sales.total}), 0)`,
            profit: sql<string>`coalesce(sum(${sales.profit}), 0)`,
          })
          .from(sales)
          .innerJoin(users, eq(sales.userId, users.id))
          .where(cond)
          .groupBy(sales.userId, users.name)
          .orderBy(desc(sql`sum(${sales.profit})`))
      : [];
    const count = totalsRows[0]?.count ?? 0;

    // ===== المطابقة المالية: تفصيل طرق الدفع يومًا بيوم =====
    // المحصّل = الإجمالي − المتبقي (يُحتسب للفواتير المكتملة فقط).
    const paymentSeriesRows = await db
      .select({
        date: sql<string>`to_char(${sales.createdAt}, 'YYYY-MM-DD')`,
        method: sales.paymentMethod,
        count: sql<number>`count(*)::int`,
        total: sql<string>`coalesce(sum(${sales.total}), 0)`,
        collected: sql<string>`coalesce(sum(coalesce(${sales.paid}, ${sales.total})), 0)`,
        unpaid: sql<string>`coalesce(sum(${sales.total} - coalesce(${sales.paid}, ${sales.total})), 0)`,
      })
      .from(sales)
      .where(cond)
      .groupBy(sql`to_char(${sales.createdAt}, 'YYYY-MM-DD')`, sales.paymentMethod)
      .orderBy(sql`to_char(${sales.createdAt}, 'YYYY-MM-DD')`);

    // تحصيل الذمم المسجّل من صفحة الديون (دفعات العملاء) — أساسي لمطابقة الصندوق.
    const [collectionByMethodRows, collectionPayments, expenseListRows] = await Promise.all([
      db
        .select({
          method: clientPayments.method,
          count: sql<number>`count(*)::int`,
          amount: sql<string>`coalesce(sum(${clientPayments.amount}), 0)`,
        })
        .from(clientPayments)
        .where(
          and(
            gte(clientPayments.createdAt, from),
            lt(clientPayments.createdAt, endExclusive),
          ),
        )
        .groupBy(clientPayments.method),
      isAdmin
        ? db
            .select({
              id: clientPayments.id,
              clientName: clients.name,
              amount: sql<string>`${clientPayments.amount}`,
              method: clientPayments.method,
              note: clientPayments.note,
              userName: clientPayments.userName,
              createdAt: clientPayments.createdAt,
            })
            .from(clientPayments)
            .innerJoin(clients, eq(clientPayments.clientId, clients.id))
            .where(
              and(
                gte(clientPayments.createdAt, from),
                lt(clientPayments.createdAt, endExclusive),
              ),
            )
            .orderBy(desc(clientPayments.createdAt))
            .limit(500)
        : [],
      isAdmin
        ? db
            .select({
              id: expenses.id,
              category: expenses.category,
              amount: expenses.amount,
              note: expenses.note,
              userName: expenses.userName,
              createdAt: expenses.createdAt,
            })
            .from(expenses)
            .where(
              and(
                gte(expenses.createdAt, from),
                lt(expenses.createdAt, endExclusive),
              ),
            )
            .orderBy(desc(expenses.createdAt))
            .limit(500)
        : [],
    ]);

    const expenseByCategory = new Map<string, number>();
    for (const r of expenseListRows) {
      const key = r.category || "أخرى";
      expenseByCategory.set(key, (expenseByCategory.get(key) ?? 0) + num(r.amount));
    }

    return ok({
      range: { from: ymd(from), to: ymd(to) },
      totals: {
        total,
        grossSales: num(totalsRows[0]?.total),
        returns: returnTotal,
        returnCount: returnTotalsRows[0]?.count ?? 0,
        // الأرباح للأدمن فقط.
        profit: isAdmin ? netProfitBeforeExpenses : 0,
        shipping: num(totalsRows[0]?.shipping),
        discount: num(totalsRows[0]?.discount),
        expenses: isAdmin ? num(expenseRows[0]?.amount) : 0,
        netProfit: isAdmin
          ? netProfitBeforeExpenses - num(expenseRows[0]?.amount)
          : 0,
        unpaid: Math.max(0, num(totalsRows[0]?.unpaid) - returnTotal),
        count,
        avg: count ? total / count : 0,
        units: unitsRow[0]?.units ?? 0,
      },
      byPayment: byPaymentRows.map((r) => {
        const method = isPaymentMethod(r.method) ? r.method : "cash";
        const refund = returnByMethod.get(method) ?? 0;
        return {
          method,
          count: r.count,
          total: num(r.total) - refund,
          unpaid: num(r.unpaid) - refund,
        };
      }),
      byEmployee: byEmployeeRows.map((e) => ({
        userId: e.userId,
        name: e.name,
        orders: e.orders,
        revenue: num(e.revenue),
        profit: isAdmin ? num(e.profit) : 0,
      })),
      // تفصيل طرق الدفع يومًا بيوم — أساس المطابقة المالية (CASH / QLICK / التوصيل).
      paymentSeries: paymentSeriesRows.map((r) => ({
        date: r.date,
        method: (isPaymentMethod(r.method) ? r.method : "cash") as PaymentMethod,
        count: r.count,
        total: num(r.total),
        collected: num(r.collected),
        unpaid: num(r.unpaid),
      })),
      // تحصيل الذمم (دفعات العملاء من صفحة الديون) — للأدمن فقط.
      collections: {
        byMethod: isAdmin
          ? collectionByMethodRows.map((r) => ({
              method: (isPaymentMethod(r.method)
                ? r.method
                : "cash") as PaymentMethod,
              count: r.count,
              amount: num(r.amount),
            }))
          : [],
        total: isAdmin
          ? collectionByMethodRows.reduce((a, r) => a + num(r.amount), 0)
          : 0,
        payments: isAdmin
          ? collectionPayments.map((p) => ({
              id: p.id,
              clientName: p.clientName,
              amount: num(p.amount),
              method: (isPaymentMethod(p.method)
                ? p.method
                : "cash") as PaymentMethod,
              note: p.note,
              userName: p.userName,
              createdAt: p.createdAt.toISOString(),
            }))
          : [],
      },
      // المصاريف التشغيلية بالتفصيل — تُخصم من الربح لحساب الربح الصافي.
      expenses: {
        rows: expenseListRows.map((r) => ({
          id: r.id,
          category: r.category || "أخرى",
          amount: num(r.amount),
          note: r.note,
          userName: r.userName,
          createdAt: r.createdAt.toISOString(),
        })),
        byCategory: isAdmin
          ? [...expenseByCategory.entries()].map(([category, amount]) => ({
              category,
              amount,
            }))
          : [],
      },
      series,
      topProducts: topProducts.map((p) => ({
        ...p,
        revenue: parseFloat(p.revenue),
        profit: isAdmin ? parseFloat(p.profit) : 0,
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
