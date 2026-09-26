import { and, desc, gte, lte, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { clients, sales } from "@/db/schema";
import { ensureSchema } from "@/lib/migrate";
import { errResponse, isErr, num, ok, requirePermission } from "@/lib/api";

export const dynamic = "force-dynamic";

type Row = {
  id: number;
  clientId: number;
  createdAt: string;
  total: number;
  shippingCost: number;
  deliveryReceivable: number;
  paid: number;
  clientName: string;
};

/**
 * حساب شركة الشحن — محاسبة مستقلة تمامًا عن نظام الذمم والآجل.
 *
 * يعرض مستحقات شركة الشحن الناتجة عن فواتير التوصيل فقط (delivery_receivable)،
 * وهي مستثناة من ذمم العملاء في /api/debts. تُسدَّد نقدًا آخر اليوم.
 *
 * GET /api/debts/courier?from=&to=
 */
export async function GET(req: Request) {
  const auth = await requirePermission("debts.view");
  if (isErr(auth)) return auth.res;
  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  await ensureSchema();

  try {
    const conds = [
      eq(sales.status, "completed"),
      sql`${sales.deliveryReceivable} > 0`,
    ];
    if (from) {
      const d = new Date(`${from}T00:00:00`);
      if (!isNaN(d.getTime())) conds.push(gte(sales.createdAt, d));
    }
    if (to) {
      const d = new Date(`${to}T23:59:59.999`);
      if (!isNaN(d.getTime())) conds.push(lte(sales.createdAt, d));
    }

    const rows = await db
      .select({
        id: sales.id,
        clientId: sales.clientId,
        createdAt: sales.createdAt,
        total: sales.total,
        shippingCost: sales.shippingCost,
        deliveryReceivable: sales.deliveryReceivable,
        paid: sales.paid,
        clientName: clients.name,
      })
      .from(sales)
      .innerJoin(clients, eq(sales.clientId, clients.id))
      .where(and(...conds))
      .orderBy(desc(sales.createdAt));

    const list: Row[] = rows.map((r) => ({
      id: r.id,
      clientId: r.clientId,
      createdAt: r.createdAt.toISOString(),
      total: num(r.total),
      shippingCost: num(r.shippingCost),
      deliveryReceivable: num(r.deliveryReceivable),
      paid: num(r.paid),
      clientName: r.clientName,
    }));

    return ok({
      rows: list,
      count: list.length,
      total: list.reduce((a, r) => a + r.deliveryReceivable, 0),
      shipping: list.reduce((a, r) => a + r.shippingCost, 0),
    });
  } catch (e) {
    return errResponse(e);
  }
}
