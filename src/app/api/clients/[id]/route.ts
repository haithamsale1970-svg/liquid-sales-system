import { desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { clients, saleItems, sales, users } from "@/db/schema";
import {
  BizError,
  bad,
  errResponse,
  isErr,
  logActivity,
  num,
  ok,
  readBody,
  requireUser,
} from "@/lib/api";
import { invoiceNo } from "@/lib/shared";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const TYPE_VALUES = new Set(["store", "company", "individual"]);

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requireUser();
  if (isErr(auth)) return auth.res;
  const { id: rawId } = await ctx.params;
  const id = Math.trunc(num(rawId));
  if (!id) return bad("معرّف غير صالح");

  try {
    const clientRows = await db
      .select()
      .from(clients)
      .where(eq(clients.id, id))
      .limit(1);
    const client = clientRows[0];
    if (!client) return bad("العميل غير موجود", 404);

    const saleRows = await db
      .select({
        id: sales.id,
        createdAt: sales.createdAt,
        status: sales.status,
        subtotal: sales.subtotal,
        shippingType: sales.shippingType,
        shippingCost: sales.shippingCost,
        total: sales.total,
        userName: users.name,
      })
      .from(sales)
      .innerJoin(users, eq(sales.userId, users.id))
      .where(eq(sales.clientId, id))
      .orderBy(desc(sales.createdAt))
      .limit(100);

    const ids = saleRows.map((s) => s.id);
    const items = ids.length
      ? await db
          .select()
          .from(saleItems)
          .where(inArray(saleItems.saleId, ids))
      : [];

    const purchases = saleRows.map((s) => ({
      id: s.id,
      invoice: invoiceNo(s.id),
      createdAt: s.createdAt.toISOString(),
      status: s.status,
      shippingType: s.shippingType,
      subtotal: num(s.subtotal),
      shippingCost: num(s.shippingCost),
      total: num(s.total),
      userName: s.userName,
      items: items
        .filter((it) => it.saleId === s.id)
        .map((it) => ({
          productName: it.productName,
          imageUrl: it.imageUrl,
          quantity: it.quantity,
          price: num(it.price),
          lineTotal: num(it.lineTotal),
        })),
    }));

    const stats = purchases
      .filter((p) => p.status === "completed")
      .reduce(
        (acc, p) => ({
          orders: acc.orders + 1,
          total: acc.total + p.total,
        }),
        { orders: 0, total: 0 },
      );

    return ok({
      client: {
        id: client.id,
        name: client.name,
        type: client.type,
        phone: client.phone,
        address: client.address,
        notes: client.notes,
        createdAt: client.createdAt.toISOString(),
      },
      stats,
      purchases,
    });
  } catch (e) {
    return errResponse(e);
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireUser();
  if (isErr(auth)) return auth.res;
  const { user } = auth;
  const { id: rawId } = await ctx.params;
  const id = Math.trunc(num(rawId));
  if (!id) return bad("معرّف غير صالح");

  const body = await readBody<Record<string, unknown>>(req);
  if (!body) return bad("طلب غير صالح");
  const name = String(body.name ?? "").trim();
  if (name.length < 2) return bad("اسم العميل مطلوب");
  const typeRaw = String(body.type ?? "individual");
  const type = (TYPE_VALUES.has(typeRaw) ? typeRaw : "individual") as
    | "store"
    | "company"
    | "individual";

  try {
    await db
      .update(clients)
      .set({
        name: name.slice(0, 120),
        type,
        phone: String(body.phone ?? "").trim().slice(0, 40),
        address: String(body.address ?? "").trim().slice(0, 200),
        notes: String(body.notes ?? "").trim().slice(0, 300),
      })
      .where(eq(clients.id, id));

    await logActivity(db, {
      userId: user.id,
      userName: user.name,
      action: "تعديل عميل",
      entity: "عميل",
      entityId: id,
      details: `تعديل بيانات العميل "${name}"`,
    });
    return ok({ ok: true });
  } catch (e) {
    return errResponse(e);
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = await requireUser();
  if (isErr(auth)) return auth.res;
  const { user } = auth;
  if (user.role !== "admin") return bad("حذف العملاء يتطلب صلاحية المدير", 403);
  const { id: rawId } = await ctx.params;
  const id = Math.trunc(num(rawId));
  if (!id) return bad("معرّف غير صالح");

  try {
    const countRows = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(sales)
      .where(eq(sales.clientId, id));
    if ((countRows[0]?.c ?? 0) > 0) {
      throw new BizError("لا يمكن حذف عميل لديه فواتير مسجلة — احتفظ بسجله", 409);
    }
    const rows = await db
      .delete(clients)
      .where(eq(clients.id, id))
      .returning({ name: clients.name });
    if (!rows[0]) return bad("العميل غير موجود", 404);
    await logActivity(db, {
      userId: user.id,
      userName: user.name,
      action: "حذف عميل",
      entity: "عميل",
      entityId: id,
      details: `حذف العميل "${rows[0].name}"`,
    });
    return ok({ ok: true });
  } catch (e) {
    return errResponse(e);
  }
}
