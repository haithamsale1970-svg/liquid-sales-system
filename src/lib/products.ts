import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { productFields, productVariants, products } from "@/db/schema";
import { num, type DbOrTx } from "./api";
import {
  NICOTINE_LEVELS,
  PRODUCT_SIZES,
  type ProductDTO,
  type ProductField,
  type ProductVariantDTO,
} from "./shared";

export function mapProduct(
  p: typeof products.$inferSelect,
  fields: ProductField[],
  variants: ProductVariantDTO[] = [],
  opts?: { hideCost?: boolean },
): ProductDTO {
  const hasVariants = variants.length > 0;
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    description: p.description,
    price: num(p.price),
    cost: opts?.hideCost ? 0 : num(p.cost),
    stock: hasVariants ? variants.reduce((sum, v) => sum + v.stock, 0) : p.stock,
    lowStockAt: p.lowStockAt,
    barcode: p.barcode ?? "",
    imageUrl: p.imageUrl,
    archived: p.archived,
    fields,
    variants: opts?.hideCost
      ? variants.map((v) => ({ ...v, cost: 0 }))
      : variants,
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

export async function loadVariantsMap(
  productIds: number[],
): Promise<Map<number, ProductVariantDTO[]>> {
  const map = new Map<number, ProductVariantDTO[]>();
  if (!productIds.length) return map;
  const rows = await db
    .select()
    .from(productVariants)
    .where(inArray(productVariants.productId, productIds))
    .orderBy(asc(productVariants.id));
  for (const r of rows) {
    if (!r.active) continue;
    const list = map.get(r.productId) ?? [];
    list.push({
      id: r.id,
      size: r.size,
      nicotine: r.nicotine,
      retailPrice: num(r.retailPrice),
      wholesalePrice: num(r.wholesalePrice),
      cost: num(r.cost),
      stock: r.stock,
      lowStockAt: r.lowStockAt,
      active: r.active,
    });
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
  const [fieldsRows, variantRows] = await Promise.all([
    conn
      .select()
      .from(productFields)
      .where(eq(productFields.productId, id))
      .orderBy(asc(productFields.id)),
    conn
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, id))
      .orderBy(asc(productVariants.id)),
  ]);
  const activeVariants = variantRows.filter((v) => v.active);
  return mapProduct(
    p,
    fieldsRows.map((f) => ({ id: f.id, label: f.label, value: f.value })),
    activeVariants.map((v) => ({
      id: v.id,
      size: v.size,
      nicotine: v.nicotine,
      retailPrice: num(v.retailPrice),
      wholesalePrice: num(v.wholesalePrice),
      cost: num(v.cost),
      stock: v.stock,
      lowStockAt: v.lowStockAt,
      active: v.active,
    })),
    opts,
  );
}

export type ProductVariantInput = {
  id?: number;
  size: string;
  nicotine: string;
  retailPrice: number;
  wholesalePrice: number;
  cost: number;
  stock: number;
  lowStockAt: number;
};

export type ProductInput = {
  name: string;
  category: string;
  description: string;
  price: number;
  cost: number;
  stock: number;
  lowStockAt: number;
  barcode: string;
  imageUrl: string;
  fields: Array<{ label: string; value: string }>;
  variants: ProductVariantInput[];
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
  const barcode = String(body.barcode ?? "").trim().slice(0, 60);
  const imageUrl = String(body.imageUrl ?? "").slice(0, 400_000);
  const rawFields = Array.isArray(body.fields) ? body.fields : [];
  const fields = rawFields
    .map((f) => ({
      label: String((f as Record<string, unknown>).label ?? "").trim().slice(0, 60),
      value: String((f as Record<string, unknown>).value ?? "").trim().slice(0, 200),
    }))
    .filter((f) => f.label && f.value)
    .slice(0, 20);
  const rawVariants = Array.isArray(body.variants) ? body.variants : [];
  const variants = rawVariants
    .map((v) => {
      const r = (v ?? {}) as Record<string, unknown>;
      const size = String(r.size ?? "").trim();
      const nicotine = String(r.nicotine ?? "").trim().toLowerCase();
      const retailPrice = num(r.retailPrice);
      const wholesalePrice = num(r.wholesalePrice);
      const variantCost = num(r.cost);
      const variantStock = Math.trunc(num(r.stock));
      const id = Math.trunc(num(r.id));
      return {
        ...(id > 0 ? { id } : {}),
        size,
        nicotine,
        retailPrice,
        wholesalePrice,
        cost: variantCost,
        stock: variantStock,
        lowStockAt: Math.max(0, Math.trunc(num(r.lowStockAt ?? 5))),
      };
    })
    .filter((v) => v.size && v.nicotine)
    .filter((v) => PRODUCT_SIZES.includes(v.size as (typeof PRODUCT_SIZES)[number]))
    .filter((v) => NICOTINE_LEVELS.includes(v.nicotine as (typeof NICOTINE_LEVELS)[number]))
    .filter((v) => v.retailPrice >= 0 && v.wholesalePrice >= 0 && v.cost >= 0 && v.stock >= 0)
    // الخانات الفارغة لا تُحفظ ولا تدخل المخزون.
    .filter((v) => v.retailPrice > 0 || v.wholesalePrice > 0 || v.stock > 0)
    .slice(0, 100);
  const effectivePrice = variants[0]?.retailPrice ?? price;
  const effectiveCost = variants[0]?.cost ?? cost;
  const effectiveStock = variants.length ? variants.reduce((s, v) => s + v.stock, 0) : stock;
  return {
    data: {
      name: name.slice(0, 120),
      category: String(body.category ?? "").trim().slice(0, 60),
      description: String(body.description ?? "").trim().slice(0, 500),
      price: effectivePrice,
      cost: effectiveCost,
      stock: effectiveStock,
      lowStockAt,
      imageUrl,
      barcode,
      fields,
      variants,
    },
  };
}

export function f2(n: number): string {
  return n.toFixed(2);
}
