import { and, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { clients, returns, sales } from "@/db/schema";
import { ensureSchema } from "@/lib/migrate";
import { errResponse, isErr, num, ok, requirePermission } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * ملخص ديون العميل: نجمع الفواتير في TypeScript لأن كل مرتجع يرتبط بفاتورة
 * محددة، بينما GROUP BY على مستوى العميل لا يمكنه استخدام sales.id داخل
 * استعلام فرعي بشكل موثوق في PostgreSQL.
 */
export async function GET(req: Request) {
  const auth = await requirePermission("debts.view");
  if (isErr(auth)) return auth.res;
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  await ensureSchema();

  try {
    const clientRows = await db
      .select({
        id: clients.id,
        name: clients.name,
        type: clients.type,
        phone: clients.phone,
      })
      .from(clients)
      .where(
        q
          ? or(
              ilike(clients.name, `%${q}%`),
              ilike(clients.phone, `%${q}%`),
            )
          : undefined,
      )
      .orderBy(desc(clients.createdAt));

    const clientIds = clientRows.map((c) => c.id);
    if (!clientIds.length) return ok([]);

    const saleRows = await db
      .select({
        id: sales.id,
        clientId: sales.clientId,
        total: sales.total,
        paid: sales.paid,
        createdAt: sales.createdAt,
      })
      .from(sales)
      .where(
        and(
          inArray(sales.clientId, clientIds),
          eq(sales.status, "completed"),
        ),
      );
    const saleIds = saleRows.map((s) => s.id);
    const returnRows = saleIds.length
      ? await db
          .select({
            saleId: returns.saleId,
            refund: returns.refund,
          })
          .from(returns)
          .where(inArray(returns.saleId, saleIds))
      : [];
    const refundBySale = new Map<number, number>();
    for (const row of returnRows) {
      refundBySale.set(
        row.saleId,
        (refundBySale.get(row.saleId) ?? 0) + num(row.refund),
      );
    }

    const summary = new Map<
      number,
      { debt: number; openSales: number; lastSaleAt: string | null }
    >();
    for (const client of clientRows) {
      summary.set(client.id, { debt: 0, openSales: 0, lastSaleAt: null });
    }
    for (const sale of saleRows) {
      const item = summary.get(sale.clientId);
      if (!item) continue;
      const total = num(sale.total);
      const paid = sale.paid === null ? total : num(sale.paid);
      const remaining = Math.max(
        0,
        total - paid - (refundBySale.get(sale.id) ?? 0),
      );
      item.debt += remaining;
      if (remaining > 0.001) item.openSales += 1;
      if (
        item.lastSaleAt === null ||
        sale.createdAt.toISOString() > item.lastSaleAt
      ) {
        item.lastSaleAt = sale.createdAt.toISOString();
      }
    }

    return ok(
      clientRows.flatMap((client) => {
        const item = summary.get(client.id);
        if (!item || item.debt <= 0.001) return [];
        return [
          {
            clientId: client.id,
            name: client.name,
            type: client.type,
            phone: client.phone,
            debt: item.debt,
            openSales: item.openSales,
            lastSaleAt: item.lastSaleAt,
          },
        ];
      }),
    );
  } catch (e) {
    return errResponse(e);
  }
}