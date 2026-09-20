import { eq } from "drizzle-orm";
import { db } from "@/db";
import { productFields, products } from "@/db/schema";
import {
  bad,
  isErr,
  logActivity,
  num,
  ok,
  readBody,
  requireAdmin,
  requireUser,
  type DbOrTx,
} from "@/lib/api";
import { f2, getProductDTO, parseProductInput } from "@/lib/products";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requireUser();
  if (isErr(auth)) return auth.res;
  const { id } = await ctx.params;
  const dto = await getProductDTO(num(id));
  if (!dto) return bad("المنتج غير موجود", 404);
  return ok(dto);
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

  const existing = await getProductDTO(id);
  if (!existing) return bad("المنتج غير موجود", 404);

  // Full-edit mode (all fields sent) vs quick actions
  if (body.mode === "edit") {
    const parsed = parseProductInput({ ...existing, ...body });
    if ("error" in parsed) return bad(parsed.error);
    const { data } = parsed;
    await db.transaction(async (tx: DbOrTx) => {
      await tx
        .update(products)
        .set({
          name: data.name,
          category: data.category,
          description: data.description,
          price: f2(data.price),
          cost: f2(data.cost),
          stock: data.stock,
          lowStockAt: data.lowStockAt,
          imageUrl: data.imageUrl,
          updatedAt: new Date(),
        })
        .where(eq(products.id, id));
      await tx.delete(productFields).where(eq(productFields.productId, id));
      if (data.fields.length) {
        await tx
          .insert(productFields)
          .values(data.fields.map((f) => ({ productId: id, label: f.label, value: f.value })));
      }
      await logActivity(tx, {
        userId: user.id,
        userName: user.name,
        action: "تعديل منتج",
        entity: "منتج",
        entityId: id,
        details: `تعديل المنتج "${data.name}"`,
      });
    });
    return ok(await getProductDTO(id));
  }

  if (body.mode === "adjustStock") {
    const delta = Math.trunc(num(body.delta));
    const note = String(body.note ?? "").slice(0, 160);
    if (!delta) return bad("أدخل قيمة تعديل صحيحة");
    const next = existing.stock + delta;
    if (next < 0) return bad("لا يمكن أن يصبح المخزون سالبًا");
    await db.transaction(async (tx: DbOrTx) => {
      await tx
        .update(products)
        .set({ stock: next, updatedAt: new Date() })
        .where(eq(products.id, id));
      await logActivity(tx, {
        userId: user.id,
        userName: user.name,
        action: "تعديل مخزون",
        entity: "منتج",
        entityId: id,
        details: `تعديل مخزون "${existing.name}" من ${existing.stock} إلى ${next}${
          note ? ` — ${note}` : ""
        }`,
      });
    });
    return ok(await getProductDTO(id));
  }

  if (body.mode === "restore") {
    if (user.role !== "admin") return bad("استعادة المنتجات تتطلب صلاحية المدير", 403);
    await db.update(products).set({ archived: false }).where(eq(products.id, id));
    await logActivity(db, {
      userId: user.id,
      userName: user.name,
      action: "استعادة منتج",
      entity: "منتج",
      entityId: id,
      details: `استعادة المنتج "${existing.name}"`,
    });
    return ok(await getProductDTO(id));
  }

  return bad("نوع التعديل غير معروف");
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = await requireAdmin();
  if (isErr(auth)) return auth.res;
  const { user } = auth;
  const { id: rawId } = await ctx.params;
  const id = Math.trunc(num(rawId));
  if (!id) return bad("معرّف غير صالح");

  const existing = await getProductDTO(id);
  if (!existing) return bad("المنتج غير موجود", 404);

  await db
    .update(products)
    .set({ archived: true, updatedAt: new Date() })
    .where(eq(products.id, id));
  await logActivity(db, {
    userId: user.id,
    userName: user.name,
    action: "أرشفة منتج",
    entity: "منتج",
    entityId: id,
    details: `أرشفة المنتج "${existing.name}"`,
  });
  return ok({ ok: true });
}
