import { and, desc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { inventoryMovements } from "@/db/schema";
import { clampInt, errResponse, isErr, num, ok, requireAdmin } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * سجل حركات المخزون (الأدمن فقط): كل دخول/خروج مع السبب والرصيد بعد الحركة.
 * فلاتر اختيارية: productId، direction (in/out)، من/إلى تاريخ.
 */
export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (isErr(auth)) return auth.res;
  const url = new URL(req.url);
  const productId = Math.trunc(num(url.searchParams.get("productId")));
  const direction = url.searchParams.get("direction") ?? "";
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  const limit = clampInt(num(url.searchParams.get("limit")) || 200, 1, 500);

  const conds = [];
  if (productId) conds.push(eq(inventoryMovements.productId, productId));
  if (direction === "in" || direction === "out")
    conds.push(eq(inventoryMovements.direction, direction));
  if (from) {
    const d = new Date(from);
    if (!isNaN(d.getTime()))
      conds.push(gte(inventoryMovements.createdAt, new Date(d.getFullYear(), d.getMonth(), d.getDate())));
  }
  if (to) {
    const d = new Date(to);
    if (!isNaN(d.getTime())) {
      const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      conds.push(lt(inventoryMovements.createdAt, end));
    }
  }

  try {
    const rows = await db
      .select()
      .from(inventoryMovements)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(inventoryMovements.createdAt))
      .limit(limit);
    return ok(
      rows.map((r) => ({
        id: r.id,
        productId: r.productId,
        productName: r.productName,
        direction: (r.direction === "out" ? "out" : "in") as "in" | "out",
        delta: r.delta,
        stockAfter: r.stockAfter,
        reason: r.reason,
        refType: r.refType,
        refId: r.refId,
        userName: r.userName,
        note: r.note,
        createdAt: r.createdAt.toISOString(),
      })),
    );
  } catch (e) {
    return errResponse(e);
  }
}