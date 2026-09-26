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
  requirePermission,
} from "@/lib/api";
import type { ClientDTO } from "@/lib/shared";
import { CLIENT_TYPES } from "@/lib/shared";
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
  const auth = await requirePermission("clients.view");
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
        googleMapsUrl: clients.googleMapsUrl,
        distributionMapUrl: clients.distributionMapUrl,
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
      googleMapsUrl: r.googleMapsUrl,
      distributionMapUrl: r.distributionMapUrl,
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
  const auth = await requirePermission("clients.create");
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
  const address = type === "individual"
    ? ""
    : String(body.address ?? "").trim().slice(0, 200);
  const googleMapsUrl = type === "individual"
    ? ""
    : String(body.googleMapsUrl ?? "").trim().slice(0, 500);
  const distributionMapUrl = type === "individual"
    ? ""
    : String(body.distributionMapUrl ?? "").trim().slice(0, 500);
  const notes = String(body.notes ?? "").trim().slice(0, 300);

  await ensureSchema();
  try {
    const rows = await db
      .insert(clients)
      .values({
        name: name.slice(0, 120),
        type,
        phone,
        phone2,
        address,
        googleMapsUrl,
        distributionMapUrl,
        notes,
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
