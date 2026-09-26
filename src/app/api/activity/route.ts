import { and, desc, eq, gte, ilike, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { activityLogs } from "@/db/schema";
import { clampInt, errResponse, isErr, num, ok, requirePermission } from "@/lib/api";

export const dynamic = "force-dynamic";

const ENTITIES = [
  "منتج",
  "عميل",
  "فاتورة",
  "مستخدم",
  "نظام",
  "دخول",
  "ديون",
  "مصروف",
  "مرتجع",
  "مخزون",
];

export async function GET(req: Request) {
  const auth = await requirePermission("activity.view");
  if (isErr(auth)) return auth.res;

  const url = new URL(req.url);
  const entity = url.searchParams.get("entity") ?? "";
  const q = (url.searchParams.get("q") ?? "").trim();
  const userId = Math.trunc(num(url.searchParams.get("userId")));
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  const limit = clampInt(num(url.searchParams.get("limit")) || 100, 1, 300);

  const conds = [];
  if (ENTITIES.includes(entity)) conds.push(eq(activityLogs.entity, entity));
  if (userId) conds.push(eq(activityLogs.userId, userId));
  if (from) {
    const d = new Date(from);
    if (!isNaN(d.getTime())) conds.push(gte(activityLogs.createdAt, d));
  }
  if (to) {
    const d = new Date(to);
    if (!isNaN(d.getTime())) {
      const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      conds.push(lt(activityLogs.createdAt, end));
    }
  }
  if (q) {
    conds.push(
      or(ilike(activityLogs.details, `%${q}%`), ilike(activityLogs.userName, `%${q}%`)),
    );
  }

  try {
    // ملخص حركات كل موظف (abood / hasan …) خلال نفس الفلاتر — لسجل التدقيق.
    const summaryRows = await db
      .select({
        userId: activityLogs.userId,
        userName: activityLogs.userName,
        total: sql<number>`count(*)::int`,
        invoices: sql<number>`count(*) filter (where ${activityLogs.entity} = 'فاتورة')::int`,
        collections: sql<number>`count(*) filter (where ${activityLogs.entity} = 'ديون')::int`,
        returns: sql<number>`count(*) filter (where ${activityLogs.entity} = 'مرتجع')::int`,
        expenses: sql<number>`count(*) filter (where ${activityLogs.entity} = 'مصروف')::int`,
        clients: sql<number>`count(*) filter (where ${activityLogs.entity} = 'عميل')::int`,
        inventory: sql<number>`count(*) filter (where ${activityLogs.entity} = 'مخزون')::int`,
        products: sql<number>`count(*) filter (where ${activityLogs.entity} = 'منتج')::int`,
        lastAt: sql<string | null>`to_char(max(${activityLogs.createdAt}), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`,
      })
      .from(activityLogs)
      .where(conds.length ? and(...conds) : undefined)
      .groupBy(activityLogs.userId, activityLogs.userName)
      .orderBy(desc(sql`count(*)`));

    const rows = await db
      .select()
      .from(activityLogs)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit);

    return ok({
      summary: summaryRows.map((s) => ({
        userId: s.userId,
        userName: s.userName,
        total: s.total,
        invoices: s.invoices,
        collections: s.collections,
        returns: s.returns,
        expenses: s.expenses,
        clients: s.clients,
        inventory: s.inventory,
        products: s.products,
        lastAt: s.lastAt,
      })),
      items: rows.map((r) => ({
        id: r.id,
        userName: r.userName,
        action: r.action,
        entity: r.entity,
        entityId: r.entityId,
        details: r.details,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    return errResponse(e);
  }
}
