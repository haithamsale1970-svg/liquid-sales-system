import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { productFields, products } from "@/db/schema";
import { bad, isErr, logActivity, ok, readBody, requireUser, type DbOrTx } from "@/lib/api";
import { logMovement } from "@/lib/inventory";
import {
  f2,
  loadFieldsMap,
  mapProduct,
  parseProductInput,
} from "@/lib/products";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireUser();
  if (isErr(auth)) return auth.res;
  const isAdmin = auth.user.role === "admin";

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

  const fieldsMap = await loadFieldsMap(rows.map((r) => r.id));
  // المستخدم العادي لا يرى الكلف أبدًا — تُصفَّر قبل الإرسال.
  return ok(rows.map((r) => mapProduct(r, fieldsMap.get(r.id) ?? [], { hideCost: !isAdmin })));
}

export async function POST(req: Request) {
  const auth = await requireUser();
  if (isErr(auth)) return auth.res;
  const { user } = auth;
  if (user.role !== "admin") return bad("إضافة الأصناف تتطلب صلاحية المدير", 403);

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
    if (data.stock > 0) {
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
