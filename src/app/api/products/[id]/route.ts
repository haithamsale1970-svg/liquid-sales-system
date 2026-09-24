import { eq } from "drizzle-orm";
import { db } from "@/db";
import { productFields, productVariants, products } from "@/db/schema";
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
import { logMovement } from "@/lib/inventory";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requireUser();
  if (isErr(auth)) return auth.res;
  const { id } = await ctx.params;
  const dto = await getProductDTO(num(id), db, { hideCost: auth.user.role !== "admin" });
  if (!dto) return bad("المنتج غير موجود", 404);
  return ok(dto);
}

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireUser();
  if (isErr(auth)) return auth.res;
  const { user } = auth;
  const isAdmin = user.role === "admin";
  const { id: rawId } = await ctx.params;
  const id = Math.trunc(num(rawId));
  if (!id) return bad("معرّف غير صالح");

  const body = await readBody<Record<string, unknown>>(req);
  if (!body) return bad("طلب غير صالح");

  const existing = await getProductDTO(id);
  if (!existing) return bad("المنتج غير موجود", 404);

  // Full-edit mode (all fields sent) vs quick actions
  // تعديل بيانات/أسعار الأصناف للأدمن فقط — المستخدم العادي لا يملك أي صلاحية إدارة.
  if (body.mode === "edit") {
    if (!isAdmin) return bad("تعديل الأصناف يتطلب صلاحية المدير", 403);
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
          barcode: data.barcode,
          imageUrl: data.imageUrl,
          updatedAt: new Date(),
        })
        .where(eq(products.id, id));
      await tx.delete(productFields).where(eq(productFields.productId, id));
      if (!data.variants.length && data.stock !== existing.stock) {
        await logMovement(tx, {
          productId: id,
          productName: data.name,
          delta: data.stock - existing.stock,
          stockAfter: data.stock,
          reason: "تعديل بيانات",
          refType: "product",
          refId: id,
          userId: user.id,
          userName: user.name,
          note: "تغيير الكمية من نموذج المنتج",
        });
      }
      const existingById = new Map(existing.variants.map((v) => [v.id, v]));
      const existingByKey = new Map(existing.variants.map((v) => [`${v.size}::${v.nicotine}`, v]));
      const keptIds = new Set<number>();
      for (const v of data.variants) {
        const old =
          (v.id && existingById.get(v.id)) ||
          existingByKey.get(`${v.size}::${v.nicotine}`) ||
          null;
        if (old) {
          keptIds.add(old.id);
          await tx
            .update(productVariants)
            .set({
              size: v.size,
              nicotine: v.nicotine,
              retailPrice: f2(v.retailPrice),
              wholesalePrice: f2(v.wholesalePrice),
              cost: f2(v.cost),
              stock: v.stock,
              lowStockAt: v.lowStockAt,
              active: true,
              updatedAt: new Date(),
            })
            .where(eq(productVariants.id, old.id));
        } else {
          await tx.insert(productVariants).values({
            productId: id,
            size: v.size,
            nicotine: v.nicotine,
            retailPrice: f2(v.retailPrice),
            wholesalePrice: f2(v.wholesalePrice),
            cost: f2(v.cost),
            stock: v.stock,
            lowStockAt: v.lowStockAt,
            active: true,
          });
        }
      }
      for (const old of existing.variants) {
        if (!keptIds.has(old.id)) {
          await tx
            .update(productVariants)
            .set({ active: false, updatedAt: new Date() })
            .where(eq(productVariants.id, old.id));
        }
      }
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
    return ok(await getProductDTO(id, db, { hideCost: !isAdmin }));
  }

  if (body.mode === "adjustStock") {
    if (!isAdmin) return bad("تعديل المخزون يتطلب صلاحية المدير", 403);
    const delta = Math.trunc(num(body.delta));
    const note = String(body.note ?? "").slice(0, 160);
    const variantId = body.variantId == null ? null : Math.trunc(num(body.variantId));
    if (!delta) return bad("أدخل قيمة تعديل صحيحة");
    if (existing.variants.length && variantId === null)
      return bad("اختر الحجم والنيكوتين قبل تعديل مخزون المنتج");
    const existingVariant = variantId === null ? null : existing.variants.find((v) => v.id === variantId);
    if (variantId !== null && !existingVariant)
      return bad("تفاصيل المخزون المحددة غير موجودة");
    const next = existing.stock + delta;
    const nextVariantStock = existingVariant ? existingVariant.stock + delta : null;
    if (next < 0 || (nextVariantStock !== null && nextVariantStock < 0))
      return bad("لا يمكن أن يصبح المخزون سالبًا");
    await db.transaction(async (tx: DbOrTx) => {
      if (existingVariant) {
        await tx
          .update(productVariants)
          .set({ stock: nextVariantStock ?? 0, updatedAt: new Date() })
          .where(eq(productVariants.id, existingVariant.id));
      }
      await tx
        .update(products)
        .set({ stock: next, updatedAt: new Date() })
        .where(eq(products.id, id));
      await logMovement(tx, {
        productId: id,
        variantId: existingVariant?.id ?? null,
        size: existingVariant?.size ?? "",
        nicotine: existingVariant?.nicotine ?? "",
        priceType: "retail",
        productName: existingVariant
          ? `${existing.name} — ${existingVariant.size} / ${existingVariant.nicotine}`
          : existing.name,
        delta,
        stockAfter: nextVariantStock ?? next,
        reason: "تسوية يدوية",
        refType: "product",
        refId: id,
        userId: user.id,
        userName: user.name,
        note,
      });
      await logActivity(tx, {
        userId: user.id,
        userName: user.name,
        action: "تعديل مخزون",
        entity: "منتج",
        entityId: id,
        details: `تعديل مخزون "${existing.name}"${
          existingVariant ? ` — ${existingVariant.size} / ${existingVariant.nicotine}` : ""
        } من ${existingVariant?.stock ?? existing.stock} إلى ${nextVariantStock ?? next}${
          note ? ` — ${note}` : ""
        }`,
      });
    });
    return ok(await getProductDTO(id, db, { hideCost: !isAdmin }));
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
    return ok(await getProductDTO(id, db, { hideCost: !isAdmin }));
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
