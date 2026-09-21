import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { productFields, products } from "@/db/schema";
import { bad, isErr, logActivity, ok, readBody, requireUser, type DbOrTx } from "@/lib/api";
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
  return ok(rows.map((r) => mapProduct(r, fieldsMap.get(r.id) ?? [])));
}

export async function POST(req: Request) {
  const auth = await requireUser();
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
        imageUrl: data.imageUrl,
      })
      .returning({ id: products.id });
    const id = rows[0].id;
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
