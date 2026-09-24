import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
import { clampInt, errResponse, isErr, num, ok, requireUser } from "@/lib/api";
import type { LowStockAlertDTO } from "@/lib/shared";

export const dynamic = "force-dynamic";

/**
 * تنبيهات انخفاض المخزون المعروضة على الشاشة (شريط التنبيه في كل الصفحات).
 * تعيد الأصناف غير المؤرشفة التي وصل مخزونها إلى حد التنبيه أو أقل،
 * مرتبة بالأشد نقصًا أولًا. لا تحتوي أي كلفة أو ربح — متاحة لكل المستخدمين.
 */
export async function GET(req: Request) {
  const auth = await requireUser();
  if (isErr(auth)) return auth.res;
  const url = new URL(req.url);
  const limit = clampInt(num(url.searchParams.get("limit")) || 6, 1, 50);

  try {
    const rows = await db
      .select({
        id: products.id,
        name: products.name,
        category: products.category,
        stock: products.stock,
        lowStockAt: products.lowStockAt,
        imageUrl: products.imageUrl,
      })
      .from(products)
      .where(
        and(
          eq(products.archived, false),
          sql`${products.stock} <= ${products.lowStockAt}`,
        ),
      )
      .orderBy(asc(products.stock), asc(products.name));

    const alerts: LowStockAlertDTO[] = rows.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      stock: r.stock,
      lowStockAt: r.lowStockAt,
      imageUrl: r.imageUrl,
    }));

    return ok({
      count: alerts.length,
      outOfStock: alerts.filter((a) => a.stock <= 0).length,
      items: alerts.slice(0, limit),
    });
  } catch (e) {
    return errResponse(e);
  }
}
