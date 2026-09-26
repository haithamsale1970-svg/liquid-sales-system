import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { clients, clientPayments, returns, sales } from "@/db/schema";
import { ensureSchema } from "@/lib/migrate";
import {
  BizError,
  bad,
  errResponse,
  isErr,
  logActivity,
  num,
  ok,
  readBody,
  requirePermission,
  type DbOrTx,
} from "@/lib/api";
import { f2 } from "@/lib/products";
import {
  PAYMENT_METHODS,
  isPaymentMethod,
  type PaymentMethod,
} from "@/lib/shared";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function remainingOf(s: { total: string; paid: string | null }): number {
  const total = num(s.total);
  const paid = s.paid === null ? total : num(s.paid);
  return Math.max(0, total - paid);
}

function remainingAfterReturns(
  s: { id: number; total: string; paid: string | null },
  refunds: Map<number, number>,
): number {
  return Math.max(0, remainingOf(s) - (refunds.get(s.id) ?? 0));
}

// تفاصيل دين عميل: فواتير غير مسددة + سجل السداد.
export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requirePermission("debts.view");
  if (isErr(auth)) return auth.res;
  const { id: rawId } = await ctx.params;
  const id = Math.trunc(num(rawId));
  if (!id) return bad("معرّف غير صالح");

  await ensureSchema();

  try {
    const clientRows = await db
      .select()
      .from(clients)
      .where(eq(clients.id, id))
      .limit(1);
    const client = clientRows[0];
    if (!client) return bad("العميل غير موجود", 404);

    const unpaidRows = await db
      .select({
        id: sales.id,
        createdAt: sales.createdAt,
        total: sales.total,
        paid: sales.paid,
        paymentMethod: sales.paymentMethod,
      })
      .from(sales)
      .where(and(eq(sales.clientId, id), eq(sales.status, "completed")))
      .orderBy(asc(sales.createdAt));

    const saleIds = unpaidRows.map((s) => s.id);
    const refundBySaleRows: Array<{ saleId: number; refund: string }> =
      saleIds.length
        ? await db
            .select({ saleId: returns.saleId, refund: sql<string>`coalesce(sum(${returns.refund}), 0)` })
            .from(returns)
            .where(and(eq(returns.clientId, id), inArray(returns.saleId, saleIds)))
            .groupBy(returns.saleId)
        : [];
    const refundBySale = new Map<number, number>(
      refundBySaleRows.map(
        (r): [number, number] => [r.saleId, num(r.refund)],
      ),
    );
    const unpaidSales = unpaidRows
      .map((s) => ({
        id: s.id,
        createdAt: s.createdAt.toISOString(),
        total: num(s.total),
        paid: s.paid === null ? num(s.total) : num(s.paid),
        remaining: remainingAfterReturns(s, refundBySale),
        refund: refundBySale.get(s.id) ?? 0,
        paymentMethod: isPaymentMethod(s.paymentMethod)
          ? s.paymentMethod
          : "cash",
      }))
      .filter((s) => s.remaining > 0.001);

    const payments = (
      await db
        .select()
        .from(clientPayments)
        .where(eq(clientPayments.clientId, id))
        .orderBy(desc(clientPayments.createdAt))
        .limit(200)
    ).map((p) => ({
      id: p.id,
      saleId: p.saleId,
      amount: num(p.amount),
      method: p.method,
      note: p.note,
      userName: p.userName,
      createdAt: p.createdAt.toISOString(),
    }));

    const balance = unpaidSales.reduce((a, s) => a + s.remaining, 0);
    return ok({
      client: {
        id: client.id,
        name: client.name,
        type: client.type,
        phone: client.phone,
      },
      balance,
      unpaidSales,
      payments,
    });
  } catch (e) {
    return errResponse(e);
  }
}

// تسديد دفعة: يوزّع المبلغ بالترتيب FIFO على أقدم الفواتير غير المسددة.
export async function POST(req: Request, ctx: Ctx) {
  const auth = await requirePermission("debts.create");
  if (isErr(auth)) return auth.res;
  const { user } = auth;
  const { id: rawId } = await ctx.params;
  const id = Math.trunc(num(rawId));
  if (!id) return bad("معرّف غير صالح");

  const body = await readBody<Record<string, unknown>>(req);
  if (!body) return bad("طلب غير صالح");
  const amount = Math.round(num(body.amount) * 1000) / 1000;
  if (!(amount > 0)) return bad("أدخل مبلغ تسديد أكبر من صفر");
  const method: PaymentMethod = isPaymentMethod(body.method)
    ? body.method
    : "cash";
  const note = String(body.note ?? "").slice(0, 160);

  await ensureSchema();
  try {
    const result = await db.transaction(async (tx: DbOrTx) => {
      const clientRows = await tx
        .select()
        .from(clients)
        .where(eq(clients.id, id))
        .limit(1);
      const client = clientRows[0];
      if (!client) throw new BizError("العميل غير موجود", 404);

      const openRows = await tx
        .select()
        .from(sales)
        .where(and(eq(sales.clientId, id), eq(sales.status, "completed")))
        .for("update");
      const refundRows: Array<{ saleId: number; refund: string }> = openRows.length
        ? await tx
            .select({ saleId: returns.saleId, refund: sql<string>`coalesce(sum(${returns.refund}), 0)` })
            .from(returns)
            .where(
              and(
                eq(returns.clientId, id),
                inArray(returns.saleId, openRows.map((s) => s.id)),
              ),
            )
            .groupBy(returns.saleId)
        : [];
      const refundBySale = new Map<number, number>(
        refundRows.map(
          (r): [number, number] => [r.saleId, num(r.refund)],
        ),
      );
      const open = openRows
        .filter((s) => remainingAfterReturns(s, refundBySale) > 0.001)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      const totalDebt = open.reduce(
        (a, s) => a + remainingAfterReturns(s, refundBySale),
        0,
      );
      if (totalDebt <= 0)
        throw new BizError("لا يوجد دين مسجل على هذا العميل", 409);

      const applied = Math.min(amount, totalDebt);
      let left = applied;
      for (const s of open) {
        if (left <= 0.0001) break;
        const remaining = remainingAfterReturns(s, refundBySale);
        const add = Math.min(left, remaining);
        if (add <= 0.0001) continue;
        const current = s.paid === null ? num(s.total) : num(s.paid);
        const adjustedTotal = num(s.total) - (refundBySale.get(s.id) ?? 0);
        await tx
          .update(sales)
          .set({ paid: f2(Math.min(adjustedTotal, current + add)) })
          .where(eq(sales.id, s.id));
        left -= add;
      }

      await tx.insert(clientPayments).values({
        clientId: id,
        amount: f2(applied),
        method,
        note,
        userId: user.id,
        userName: user.name,
      });

      await logActivity(tx, {
        userId: user.id,
        userName: user.name,
        action: "تحصيل دفعة",
        entity: "ديون",
        entityId: id,
        details: `تسديد ${f2(applied)} للعميل "${client.name}" (${PAYMENT_METHODS[method]})${
          applied >= totalDebt - 0.001 ? " — سداد كامل للدين" : ""
        }${note ? ` — ${note}` : ""}`,
      });

      return {
        applied,
        fullyPaid: applied >= totalDebt - 0.001,
        remainingAfter: Math.max(0, totalDebt - applied),
      };
    });
    return ok(result);
  } catch (e) {
    return errResponse(e);
  }
}