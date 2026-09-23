import { desc, eq, ilike, sql } from "drizzle-orm";
import { db } from "@/db";
import { clients, sales } from "@/db/schema";
import {
  bad,
  errResponse,
  isErr,
  logActivity,
  ok,
  readBody,
  requireUser,
} from "@/lib/api";
import type { ClientDTO } from "@/lib/shared";

export const dynamic = "force-dynamic";

const TYPE_VALUES = new Set(["store", "company", "individual"]);

export async function GET(req: Request) {
  const auth = await requireUser();
  if (isErr(auth)) return auth.res;
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();

  try {
    const rows = await db
      .select({
        id: clients.id,
        name: clients.name,
        type: clients.type,
        phone: clients.phone,
        address: clients.address,
        notes: clients.notes,
        createdAt: clients.createdAt,
        ordersCount: sql<number>`count(*) filter (where ${sales.id} is not null and ${sales.status} = 'completed')::int`,
        totalSpent: sql<string>`coalesce(sum(${sales.total}) filter (where ${sales.status} = 'completed'), 0)`,
      })
      .from(clients)
      .leftJoin(sales, eq(sales.clientId, clients.id))
      .where(q ? ilike(clients.name, `%${q}%`) : undefined)
      .groupBy(clients.id)
      .orderBy(desc(clients.createdAt));

    const data: ClientDTO[] = rows.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      phone: r.phone,
      address: r.address,
      notes: r.notes,
      createdAt: r.createdAt.toISOString(),
      ordersCount: r.ordersCount,
      totalSpent: parseFloat(r.totalSpent),
    }));
    return ok(data);
  } catch (e) {
    return errResponse(e);
  }
}

export async function POST(req: Request) {
  const auth = await requireUser();
  if (isErr(auth)) return auth.res;
  const { user } = auth;
  if (user.role !== "admin") return bad("إضافة العملاء للمدير فقط — المستخدم ينشئ فواتير البيع فقط", 403);

  const body = await readBody<Record<string, unknown>>(req);
  if (!body) return bad("طلب غير صالح");
  const name = String(body.name ?? "").trim();
  if (name.length < 2) return bad("اسم العميل مطلوب");
  const typeRaw = String(body.type ?? "individual");
  const type = (TYPE_VALUES.has(typeRaw) ? typeRaw : "individual") as
    | "store"
    | "company"
    | "individual";

  try {
    const rows = await db
      .insert(clients)
      .values({
        name: name.slice(0, 120),
        type,
        phone: String(body.phone ?? "").trim().slice(0, 40),
        address: String(body.address ?? "").trim().slice(0, 200),
        notes: String(body.notes ?? "").trim().slice(0, 300),
      })
      .returning({ id: clients.id });

    await logActivity(db, {
      userId: user.id,
      userName: user.name,
      action: "إضافة عميل",
      entity: "عميل",
      entityId: rows[0].id,
      details: `إضافة العميل "${name}"`,
    });
    return ok({ id: rows[0].id }, { status: 201 });
  } catch (e) {
    return errResponse(e);
  }
}
