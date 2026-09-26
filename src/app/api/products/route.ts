import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { productFields, productVariants, products } from "@/db/schema";
import { bad, isErr, logActivity, ok, readBody, requirePermission, type DbOrTx } from "@/lib/api";
import { can } from "@/lib/permissions";
import { logMovement } from "@/lib/inventory";
import {
  f2,
  loadFieldsMap,
  loadVariantsMap,
  mapProduct,
  parseProductInput,
} from "@/lib/products";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requirePermission("products.view");
  if (isErr(auth)) return auth.res;
  // إخفاء الكلف إلا لمن يملك صلاحية الاطلاع على التكاليف.
  const hideCost = !can(auth.user, "finances.view_cost");

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const category = (url.searchParams.get("category") ?? "").trim();
  const includeArchived = url.searchParams.get("archived") === "1";

  const conds = [];
  if (!includeArchived) conds.push(eq(products.archived, false));
  if (q) {
    const like = `%${q}%`;
    conds.push(or(ilike(products.name, like), ilike(products.category, like)));
  }
  if (category) conds.push(eq(products.category, category));

  const rows = await db
    .select()
    .from(products)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(products.createdAt));

  const [fieldsMap, variantsMap] = await Promise.all([
    loadFieldsMap(rows.map((r) => r.id)),
    loadVariantsMap(rows.map((r) => r.id)),
  ]);
  // المستخدم الذي لا يملك صلاحية التكاليف لا يرىها — تُصفَّر قبل الإرسال.
  return ok(
    rows.map((r) =>
      mapProduct(
        r,
        fieldsMap.get(r.id) ?? [],
        variantsMap.get(r.id) ?? [],
        { hideCost },
      ),
    ),
  );
}

export async function POST(req: Request) {
  const auth = await requirePermission("products.create");
  if (isErr(auth)) return auth.res;
  const { user } = auth;

  const body = await readBody<Record<string, unknown>>(req);
  if (!body) return bad("طلب غير صالح");
  const parsed = parseProductInput(body);
  if ("error" in parsed) return bad(parsed.error);
  const { data } = parsed;

  const createdId = await db.transaction(async (tx: DbOrTx) => {
    const rows = await tx
      .insert(products)
      .values({
        name: data.name,
        category: data.category,
        description: data.description,
        price: f2(data.price),
        cost: f2(data.cost),
        stock: data.stock,
        lowStockAt: data.lowStockAt,
        barcode: data.barcode,
        imageUrl: data.imageUrl,
      })
      .returning({ id: products.id });
    const id = rows[0].id;
    // رصيد افتتاحي — يُسجّل كحركة دخول في سجل المخزون.
    // عند وجود متغيرات، يُسجّل الرصيد لكل متغير فقط لتجنب مضاعفة المخزون.
    if (data.stock > 0 && !data.variants.length) {
      await logMovement(tx, {
        productId: id,
        productName: data.name,
        delta: data.stock,
        stockAfter: data.stock,
        reason: "رصيد افتتاحي",
        refType: "product",
        refId: id,
        userId: user.id,
        userName: user.name,
      });
    }
    if (data.fields.length) {
      await tx.insert(productFields).values(
        data.fields.map((f) => ({ productId: id, label: f.label, value: f.value })),
      );
    }
    if (data.variants.length) {
      const createdVariants = await tx
        .insert(productVariants)
        .values(
          data.variants.map((v) => ({
            productId: id,
            size: v.size,
            nicotine: v.nicotine,
            retailPrice: f2(v.retailPrice),
            wholesalePrice: f2(v.wholesalePrice),
            cost: f2(v.cost),
            stock: v.stock,
            lowStockAt: v.lowStockAt,
            active: true,
          })),
        )
        .returning({
          id: productVariants.id,
          size: productVariants.size,
          nicotine: productVariants.nicotine,
          stock: productVariants.stock,
        });
      for (const v of createdVariants) {
        if (v.stock > 0) {
          await logMovement(tx, {
            productId: id,
            variantId: v.id,
            size: v.size,
            nicotine: v.nicotine,
            priceType: "retail",
            productName: `${data.name} — ${v.size} / ${v.nicotine}`,
            delta: v.stock,
            stockAfter: v.stock,
            reason: "رصيد افتتاحي",
            refType: "product",
            refId: id,
            userId: user.id,
            userName: user.name,
          });
        }
      }
    }
    await logActivity(tx, {
      userId: user.id,
      userName: user.name,
      action: "إضافة منتج",
      entity: "منتج",
      entityId: id,
      details: `إضافة المنتج "${data.name}" — المخزون: ${data.stock}`,
    });
    return id;
  });

  return ok({ id: createdId }, { status: 201 });
}
