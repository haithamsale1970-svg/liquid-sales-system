import { desc, eq, ilike, or, sql } from "drizzle-orm";
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
import { CLIENT_TYPES } from "@/lib/shared";
import { getAppSettings } from "@/lib/settings";
import { ensureSchema } from "@/lib/migrate";

export const dynamic = "force-dynamic";

const TYPE_VALUES = new Set(["store", "company", "individual"]);

function cleanPhone(v: unknown): string {
  return String(v ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 40);
}

export async function GET(req: Request) {
  const auth = await requireUser();
  if (isErr(auth)) return auth.res;
  await ensureSchema();
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();

  try {
    const rows = await db
      .select({
        id: clients.id,
        name: clients.name,
        type: clients.type,
        phone: clients.phone,
        phone2: clients.phone2,
        address: clients.address,
        notes: clients.notes,
        createdAt: clients.createdAt,
        ordersCount: sql<number>`count(*) filter (where ${sales.id} is not null and ${sales.status} = 'completed')::int`,
        totalSpent: sql<string>`coalesce(sum(${sales.total}) filter (where ${sales.status} = 'completed'), 0)`,
        // الصافي = إجمالي الفواتير − المدفوع − صافي المرتجعات المرتبطة بالعميل.
        // استعلام المرتجعات هنا على مستوى العميل حتى يبقى ضمن تجميع GROUP BY صالح.
        debt: sql<string>`coalesce(sum(${sales.total} - coalesce(${sales.paid}, ${sales.total})) filter (where ${sales.status} = 'completed'), 0) - coalesce((select sum(r.refund) from "returns" r where r.client_id = ${clients.id}), 0)`,
        lastSaleAt: sql<string | null>`to_char(max(${sales.createdAt}) filter (where ${sales.status} = 'completed'), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`,
      })
      .from(clients)
      .leftJoin(sales, eq(sales.clientId, clients.id))
      .where(
        q
          ? or(
              ilike(clients.name, `%${q}%`),
              ilike(clients.phone, `%${q}%`),
              ilike(clients.phone2, `%${q}%`),
            )
          : undefined,
      )
      .groupBy(clients.id)
      .orderBy(desc(clients.createdAt));

    const data: ClientDTO[] = rows.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      phone: r.phone,
      phone2: r.phone2 ?? "",
      address: r.address,
      notes: r.notes,
      createdAt: r.createdAt.toISOString(),
      ordersCount: r.ordersCount,
      totalSpent: parseFloat(r.totalSpent),
      lastSaleAt: r.lastSaleAt,
      debt: Math.max(0, parseFloat(r.debt)),
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

  const body = await readBody<Record<string, unknown>>(req);
  if (!body) return bad("طلب غير صالح");
  const name = String(body.name ?? "").trim();
  if (name.length < 2) return bad("اسم العميل مطلوب");
  const typeRaw = String(body.type ?? "individual");
  const type = (TYPE_VALUES.has(typeRaw) ? typeRaw : "individual") as
    | "store"
    | "company"
    | "individual";
  const phone = cleanPhone(body.phone);
  const phone2 = cleanPhone(body.phone2);

  await ensureSchema();
  // الإعداد العام يعمل ك مفتاح master، والصلاحية النهائية لكل موظف
  // تُمنح من صفحة المستخدمين (abood / hasan ...).
  if (user.role !== "admin") {
    const settings = await getAppSettings();
    if (!settings.allowUsersEditClients || !user.canEditClients)
      return bad(
        "إضافة العملاء تتطلب صلاحية المدير — اطلب من الماستر تفعيل الإعداد العام ثم منح صلاحية هذا الموظف من صفحة المستخدمين",
        403,
      );
  }

  try {
    const rows = await db
      .insert(clients)
      .values({
        name: name.slice(0, 120),
        type,
        phone,
        phone2,
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
      details: `إضافة العميل "${name}" (${CLIENT_TYPES[type]})${
        phone ? ` • هاتف ${phone}` : ""
      }${phone2 ? ` • هاتف 2: ${phone2}` : ""}`,
    });
    return ok({ id: rows[0].id }, { status: 201 });
  } catch (e) {
    return errResponse(e);
  }
}
