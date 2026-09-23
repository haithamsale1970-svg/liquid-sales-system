import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { clients, products, saleItems, sales, users } from "@/db/schema";
import {
  BizError,
  bad,
  errResponse,
  isErr,
  logActivity,
  num,
  ok,
  readBody,
  requireAdmin,
  requireUser,
  type DbOrTx,
} from "@/lib/api";
import { invoiceNo } from "@/lib/shared";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requireUser();
  if (isErr(auth)) return auth.res;
  const isAdmin = auth.user.role === "admin";
  const { id: rawId } = await ctx.params;
  const id = Math.trunc(num(rawId));
  if (!id) return bad("معرّف غير صالح");

  try {
    const rows = await db
      .select({
        sale: sales,
        client: clients,
        sellerName: users.name,
        sellerUsername: users.username,
      })
      .from(sales)
      .innerJoin(clients, eq(sales.clientId, clients.id))
      .innerJoin(users, eq(sales.userId, users.id))
      .where(eq(sales.id, id))
      .limit(1);
    const row = rows[0];
    if (!row) return bad("الفاتورة غير موجودة", 404);

    const items = await db
      .select()
      .from(saleItems)
      .where(eq(saleItems.saleId, id))
      .orderBy(asc(saleItems.id));

    return ok({
      id: row.sale.id,
      status: row.sale.status,
      subtotal: num(row.sale.subtotal),
      shippingType: row.sale.shippingType,
      shippingCost: num(row.sale.shippingCost),
      total: num(row.sale.total),
      // الربح للأدمن فقط.
      profit: isAdmin ? num(row.sale.profit) : 0,
      currency: row.sale.currency ?? "JOD",
      rate: num(row.sale.rate) || 1,
      notes: row.sale.notes,
      createdAt: row.sale.createdAt.toISOString(),
      client: {
        id: row.client.id,
        name: row.client.name,
        type: row.client.type,
        phone: row.client.phone,
        address: row.client.address,
      },
      seller: {
        id: row.sale.userId,
        name: row.sellerName,
        username: row.sellerUsername,
      },
      items: items.map((it) => ({
        id: it.id,
        productId: it.productId,
        productName: it.productName,
        imageUrl: it.imageUrl,
        price: num(it.price),
        quantity: it.quantity,
        lineTotal: num(it.lineTotal),
      })),
      // التكلفة مخفية عن المستخدم العادي.
      ...(isAdmin ? {} : { itemsHiddenCost: true }),
    });
  } catch (e) {
    return errResponse(e);
  }
}

// Cancel an invoice (admin only) — restores stock atomically.
export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireAdmin();
  if (isErr(auth)) return auth.res;
  const { user } = auth;
  const { id: rawId } = await ctx.params;
  const id = Math.trunc(num(rawId));
  if (!id) return bad("معرّف غير صالح");

  const body = await readBody<{ action?: string }>(req);
  if (body?.action !== "cancel") return bad("إجراء غير معروف");

  try {
    await db.transaction(async (tx: DbOrTx) => {
      const rows = await tx
        .select()
        .from(sales)
        .where(eq(sales.id, id))
        .for("update")
        .limit(1);
      const sale = rows[0];
      if (!sale) throw new BizError("الفاتورة غير موجودة", 404);
      if (sale.status === "cancelled")
        throw new BizError("هذه الفاتورة ملغاة بالفعل");

      const items = await tx
        .select()
        .from(saleItems)
        .where(eq(saleItems.saleId, id));
      for (const it of items) {
        await tx
          .update(products)
          .set({
            stock: sql`${products.stock} + ${it.quantity}`,
            updatedAt: new Date(),
          })
          .where(eq(products.id, it.productId));
      }
      await tx
        .update(sales)
        .set({ status: "cancelled" })
        .where(eq(sales.id, id));
      await logActivity(tx, {
        userId: user.id,
        userName: user.name,
        action: "إلغاء فاتورة",
        entity: "فاتورة",
        entityId: id,
        details: `إلغاء الفاتورة ${invoiceNo(id)} واسترجاع ${items.length} صنف للمخزون`,
      });
    });
    return ok({ ok: true });
  } catch (e) {
    return errResponse(e);
  }
}
