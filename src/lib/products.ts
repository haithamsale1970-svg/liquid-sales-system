import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { productFields, products } from "@/db/schema";
import { num, type DbOrTx } from "./api";
import type { ProductDTO, ProductField } from "./shared";

export function mapProduct(
  p: typeof products.$inferSelect,
  fields: ProductField[],
  opts?: { hideCost?: boolean },
): ProductDTO {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    description: p.description,
    price: num(p.price),
    cost: opts?.hideCost ? 0 : num(p.cost),
    stock: p.stock,
    lowStockAt: p.lowStockAt,
    imageUrl: p.imageUrl,
    archived: p.archived,
    fields,
    createdAt: p.createdAt.toISOString(),
  };
}

export async function loadFieldsMap(
  productIds: number[],
): Promise<Map<number, ProductField[]>> {
  const map = new Map<number, ProductField[]>();
  if (!productIds.length) return map;
  const rows = await db
    .select()
    .from(productFields)
    .where(inArray(productFields.productId, productIds))
    .orderBy(asc(productFields.id));
  for (const r of rows) {
    const list = map.get(r.productId) ?? [];
    list.push({ id: r.id, label: r.label, value: r.value });
    map.set(r.productId, list);
  }
  return map;
}

export async function getProductDTO(
  id: number,
  conn: DbOrTx = db,
  opts?: { hideCost?: boolean },
): Promise<ProductDTO | null> {
  const rows = await conn
    .select()
    .from(products)
    .where(eq(products.id, id))
    .limit(1);
  const p = rows[0];
  if (!p) return null;
  const fieldsRows = await conn
    .select()
    .from(productFields)
    .where(eq(productFields.productId, id))
    .orderBy(asc(productFields.id));
  return mapProduct(
    p,
    fieldsRows.map((f) => ({ id: f.id, label: f.label, value: f.value })),
    opts,
  );
}

export type ProductInput = {
  name: string;
  category: string;
  description: string;
  price: number;
  cost: number;
  stock: number;
  lowStockAt: number;
  imageUrl: string;
  fields: Array<{ label: string; value: string }>;
};

export function parseProductInput(
  body: Record<string, unknown>,
): { error: string } | { data: ProductInput } {
  const name = String(body.name ?? "").trim();
  if (name.length < 2) return { error: "اسم المنتج مطلوب (حرفان على الأقل)" };
  const price = num(body.price);
  const cost = num(body.cost);
  if (price < 0 || cost < 0) return { error: "السعر والتكلفة لا يمكن أن يكونا سالبين" };
  const stock = Math.trunc(num(body.stock));
  if (stock < 0) return { error: "الكمية لا يمكن أن تكون سالبة" };
  const lowStockAt = Math.max(0, Math.trunc(num(body.lowStockAt ?? 5)));
  const imageUrl = String(body.imageUrl ?? "").slice(0, 400_000);
  const rawFields = Array.isArray(body.fields) ? body.fields : [];
  const fields = rawFields
    .map((f) => ({
      label: String((f as Record<string, unknown>).label ?? "").trim().slice(0, 60),
      value: String((f as Record<string, unknown>).value ?? "").trim().slice(0, 200),
    }))
    .filter((f) => f.label && f.value)
    .slice(0, 20);
  return {
    data: {
      name: name.slice(0, 120),
      category: String(body.category ?? "").trim().slice(0, 60),
      description: String(body.description ?? "").trim().slice(0, 500),
      price,
      cost,
      stock,
      lowStockAt,
      imageUrl,
      fields,
    },
  };
}

export function f2(n: number): string {
  return n.toFixed(2);
}
