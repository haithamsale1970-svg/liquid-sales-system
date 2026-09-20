import { db } from "@/db";
import {
  activityLogs,
  clients,
  productFields,
  products,
  saleItems,
  sales,
  users,
} from "@/db/schema";
import { errResponse, isErr, logActivity, requireAdmin } from "@/lib/api";

export const dynamic = "force-dynamic";

// Full JSON backup of all business tables (admin only).
function csvSafe(v: unknown) {
  if (v instanceof Date) return v.toISOString();
  return v;
}

export async function GET() {
  const auth = await requireAdmin();
  if (isErr(auth)) return auth.res;
  const { user } = auth;

  try {
    const tables = {
      users: (await db.select().from(users)).map((u) => ({
        ...u,
        passwordHash: "[REDACTED]",
      })),
      products: await db.select().from(products),
      product_fields: await db.select().from(productFields),
      clients: await db.select().from(clients),
      sales: await db.select().from(sales),
      sale_items: await db.select().from(saleItems),
      activity_logs: await db
        .select()
        .from(activityLogs)
        .orderBy(activityLogs.id)
        .limit(5000),
    };

    const payload = {
      meta: {
        app: "SOHOB — نظام إدارة مبيعات ومخزون الليكويد",
        version: 1,
        exportedBy: user.username,
        exportedAt: new Date().toISOString(),
        counts: Object.fromEntries(
          Object.entries(tables).map(([k, v]) => [k, v.length]),
        ),
      },
      tables: JSON.parse(JSON.stringify(tables, (_k, v) => csvSafe(v))),
    };

    await logActivity(db, {
      userId: user.id,
      userName: user.name,
      action: "نسخ احتياطي",
      entity: "نظام",
      details: "تصدير نسخة احتياطية كاملة (JSON)",
    });

    const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="sohob-backup-${stamp}.json"`,
      },
    });
  } catch (e) {
    return errResponse(e);
  }
}
