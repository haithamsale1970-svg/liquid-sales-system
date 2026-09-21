import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { activityLogs } from "@/db/schema";
import { clampInt, errResponse, isErr, num, ok, requireAdmin } from "@/lib/api";

export const dynamic = "force-dynamic";

const ENTITIES = ["منتج", "عميل", "فاتورة", "مستخدم", "نظام", "دخول"];

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (isErr(auth)) return auth.res;

  const url = new URL(req.url);
  const entity = url.searchParams.get("entity") ?? "";
  const q = (url.searchParams.get("q") ?? "").trim();
  const limit = clampInt(num(url.searchParams.get("limit")) || 100, 1, 300);

  const conds = [];
  if (ENTITIES.includes(entity)) conds.push(eq(activityLogs.entity, entity));
  if (q) {
    conds.push(
      or(ilike(activityLogs.details, `%${q}%`), ilike(activityLogs.userName, `%${q}%`)),
    );
  }

  try {
    const rows = await db
      .select()
      .from(activityLogs)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit);
    return ok(
      rows.map((r) => ({
        id: r.id,
        userName: r.userName,
        action: r.action,
        entity: r.entity,
        entityId: r.entityId,
        details: r.details,
        createdAt: r.createdAt.toISOString(),
      })),
    );
  } catch (e) {
    return errResponse(e);
  }
}
