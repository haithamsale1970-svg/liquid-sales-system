import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { clients, saleInstallments, sales } from "@/db/schema";
import { ensureSchema } from "@/lib/migrate";
import {
  bad,
  errResponse,
  isErr,
  logActivity,
  num,
  ok,
  readBody,
  requirePermission,
} from "@/lib/api";
import type { InstallmentDTO, InstallmentPlanDTO } from "@/lib/shared";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function toDTO(
  r: typeof saleInstallments.$inferSelect,
  clientName = "",
): InstallmentDTO {
  return {
    id: r.id,
    saleId: r.saleId,
    seq: r.seq,
    amount: num(r.amount),
    dueDate: r.dueDate.toISOString(),
    status: r.status === "paid" ? "paid" : "pending",
    paidAt: r.paidAt ? r.paidAt.toISOString() : null,
    note: r.note,
    clientName,
  };
}

/**
 * GET /api/sales/[id]/installments
 *  - id = 0  → الدفعات المستحقة والقريبة خلال 30 يومًا (لأجل التنبيهات).
 *  - id > 0  → خطة تقسيط فاتورة محددة.
 */
export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requirePermission("sales.installments");
  if (isErr(auth)) return auth.res;
  const { id } = await ctx.params;
  const saleId = Math.trunc(num(id));

  try {
    await ensureSchema();

    if (saleId > 0) {
      const rows = await db
        .select()
        .from(saleInstallments)
        .where(eq(saleInstallments.saleId, saleId))
        .orderBy(asc(saleInstallments.seq), asc(saleInstallments.dueDate));
      return ok(rows.map((r) => toDTO(r)));
    }

    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 30);

    const rows = await db
      .select({ ins: saleInstallments, clientName: clients.name })
      .from(saleInstallments)
      .innerJoin(sales, eq(saleInstallments.saleId, sales.id))
      .innerJoin(clients, eq(sales.clientId, clients.id))
      .where(
        and(
          eq(saleInstallments.status, "pending"),
          gte(saleInstallments.dueDate, from),
          lte(saleInstallments.dueDate, to),
        ),
      )
      .orderBy(asc(saleInstallments.dueDate));
    return ok(rows.map((r) => toDTO(r.ins, r.clientName)));
  } catch (e) {
    return errResponse(e);
  }
}

/** PUT: استبدال خطة التقسيط كاملة لفاتورة (يُحذف القديم ويُعاد البناء). */
export async function PUT(req: Request, ctx: Ctx) {
  const auth = await requirePermission("sales.installments");
  if (isErr(auth)) return auth.res;
  const { user } = auth;
  const { id: rawId } = await ctx.params;
  const saleId = Math.trunc(num(rawId));
  if (!saleId) return bad("معرّف الفاتورة غير صالح");

  const body = await readBody<{ installments?: unknown }>(req);
  if (!body) return bad("طلب غير صالح");
  const input = Array.isArray(body.installments) ? body.installments : [];

  try {
    await ensureSchema();

    const saleRows = await db
      // "المتبقي" محسوب (total − paid) وليس عمودًا مخزّنًا
      .select({
        id: sales.id,
        total: sales.total,
        paid: sales.paid,
      })
      .from(sales)
      .where(eq(sales.id, saleId))
      .limit(1);
    if (!saleRows[0]) return bad("الفاتورة غير موجودة", 404);

    const parsed: InstallmentPlanDTO[] = [];
    for (const raw of input) {
      const o = (raw ?? {}) as Record<string, unknown>;
      const amount = Number(num(o.amount));
      const d = new Date(String(o.dueDate ?? ""));
      if (!amount || amount <= 0) return bad("كل دفعة يجب أن تكون بمبلغ أكبر من صفر");
      if (isNaN(d.getTime())) return bad("تاريخ استحقاق غير صالح لكل دفعة");
      parsed.push({
        amount: Number(amount.toFixed(2)),
        dueDate: d.toISOString(),
        note: String(o.note ?? "").slice(0, 140),
      });
    }

    const planTotal = Number(
      parsed.reduce((a, p) => a + p.amount, 0).toFixed(2),
    );
    const owed = Number(
      (num(saleRows[0].total) - num(saleRows[0].paid)).toFixed(2),
    );
    // نسمح بخطة أقل من المتبقي (باقي الدين غير مجدول) بشرط ألا تتجاوزه.
    if (planTotal > owed + 0.01)
      return bad(
        `مجموع الدفعات (${planTotal}) أكبر من المبلغ المتبقي على الفاتورة (${owed})`,
      );

    await db.transaction(async (tx) => {
      await tx.delete(saleInstallments).where(eq(saleInstallments.saleId, saleId));
      if (parsed.length) {
        await tx.insert(saleInstallments).values(
          parsed.map((p, i) => ({
            saleId,
            seq: i + 1,
            amount: p.amount.toFixed(2),
            dueDate: new Date(p.dueDate),
            status: "pending",
            note: p.note,
          })),
        );
      }
    });

    await logActivity(db, {
      userId: user.id,
      userName: user.name,
      action: "ضبط تقسيط",
      entity: "فاتورة",
      entityId: saleId,
      details: `جدولة ${parsed.length} دفعة بإجمالي ${planTotal} (المتبقي ${owed})`,
    });

    const rows = await db
      .select()
      .from(saleInstallments)
      .where(eq(saleInstallments.saleId, saleId))
      .orderBy(asc(saleInstallments.seq));
    return ok({ plan: rows.map((r) => toDTO(r)), planTotal, owed });
  } catch (e) {
    return errResponse(e);
  }
}

/** PATCH: تعليم دفعة كمسدّدة (أو إرجاعها لحالة مستحقة). */
export async function PATCH(req: Request) {
  const auth = await requirePermission("sales.installments");
  if (isErr(auth)) return auth.res;
  const { user } = auth;

  const body = await readBody<Record<string, unknown>>(req);
  if (!body) return bad("طلب غير صالح");
  const id = Math.trunc(num(body.id));
  if (!id) return bad("معرّف الدفعة غير صالح");
  const paid = body.paid !== false;

  try {
    await ensureSchema();
    const cur = await db
      .select()
      .from(saleInstallments)
      .where(eq(saleInstallments.id, id))
      .limit(1);
    if (!cur[0]) return bad("الدفعة غير موجودة", 404);

    await db
      .update(saleInstallments)
      .set({ status: paid ? "paid" : "pending", paidAt: paid ? new Date() : null })
      .where(eq(saleInstallments.id, id));

    await logActivity(db, {
      userId: user.id,
      userName: user.name,
      action: paid ? "تسديد دفعة" : "إرجاع دفعة",
      entity: "فاتورة",
      entityId: cur[0].saleId,
      details: `${paid ? "تسديد" : "إرجاع"} دفعة رقم ${cur[0].seq} (${num(cur[0].amount)})`,
    });

    return ok({ ok: true, id, status: paid ? "paid" : "pending" });
  } catch (e) {
    return errResponse(e);
  }
}

/** DELETE: حذف خطة التقسيط بالكامل لفاتورة. */
export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = await requirePermission("sales.installments");
  if (isErr(auth)) return auth.res;
  const { id: rawId } = await ctx.params;
  const saleId = Math.trunc(num(rawId));
  if (!saleId) return bad("معرّف الفاتورة غير صالح");
  try {
    await ensureSchema();
    await db.delete(saleInstallments).where(eq(saleInstallments.saleId, saleId));
    return ok({ ok: true });
  } catch (e) {
    return errResponse(e);
  }
}
