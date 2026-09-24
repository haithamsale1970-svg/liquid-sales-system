import { desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { clients, saleItems, sales, users } from "@/db/schema";
import {
  BizError,
  bad,
  errResponse,
  isErr,
  logActivity,
  num,
  ok,
  readBody,
  requireUser,
} from "@/lib/api";
import { getAppSettings } from "@/lib/settings";
import { ensureSchema } from "@/lib/migrate";
import { CLIENT_TYPES, invoiceNo, type ClientType } from "@/lib/shared";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const TYPE_VALUES = new Set(["store", "company", "individual"]);

function cleanPhone(v: unknown): string {
  return String(v ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 40);
}

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requireUser();
  if (isErr(auth)) return auth.res;
  const { id: rawId } = await ctx.params;
  const id = Math.trunc(num(rawId));
  if (!id) return bad("معرّف غير صالح");

  await ensureSchema();
  try {
    const clientRows = await db
      .select()
      .from(clients)
      .where(eq(clients.id, id))
      .limit(1);
    const client = clientRows[0];
    if (!client) return bad("العميل غير موجود", 404);

    const saleRows = await db
      .select({
        id: sales.id,
        createdAt: sales.createdAt,
        status: sales.status,
        subtotal: sales.subtotal,
        shippingType: sales.shippingType,
        shippingCost: sales.shippingCost,
        total: sales.total,
        userName: users.name,
      })
      .from(sales)
      .innerJoin(users, eq(sales.userId, users.id))
      .where(eq(sales.clientId, id))
      .orderBy(desc(sales.createdAt))
      .limit(100);

    const ids = saleRows.map((s) => s.id);
    const items = ids.length
      ? await db
          .select()
          .from(saleItems)
          .where(inArray(saleItems.saleId, ids))
      : [];

    const purchases = saleRows.map((s) => ({
      id: s.id,
      invoice: invoiceNo(s.id),
      createdAt: s.createdAt.toISOString(),
      status: s.status,
      shippingType: s.shippingType,
      subtotal: num(s.subtotal),
      shippingCost: num(s.shippingCost),
      total: num(s.total),
      userName: s.userName,
      items: items
        .filter((it) => it.saleId === s.id)
        .map((it) => ({
          productName: it.productName,
          imageUrl: it.imageUrl,
          quantity: it.quantity,
          price: num(it.price),
          lineTotal: num(it.lineTotal),
        })),
    }));

    // إحصاءات دقيقة على كل فواتير العميل (لا تقتصر على آخر 100 فاتورة).
    const statsRows = await db
      .select({
        orders: sql<number>`count(*) filter (where ${sales.status} = 'completed')::int`,
        total: sql<string>`coalesce(sum(${sales.total}) filter (where ${sales.status} = 'completed'), 0)`,
        debt: sql<string>`coalesce(sum(${sales.total} - coalesce(${sales.paid}, ${sales.total})) filter (where ${sales.status} = 'completed'), 0) - coalesce((select sum(r.refund) from "returns" r where r.client_id = ${id}), 0)`,
        lastOrderAt: sql<string | null>`to_char(max(${sales.createdAt}) filter (where ${sales.status} = 'completed'), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`,
      })
      .from(sales)
      .where(eq(sales.clientId, id));
    const agg = statsRows[0];

    // الأصناف المفضّلة (الأكثر تكرارًا في فواتير العميل) — تُعرض في الفاتورة الجديدة.
    const favRows = await db
      .select({
        productId: saleItems.productId,
        name: saleItems.productName,
        imageUrl: saleItems.imageUrl,
        qty: sql<number>`coalesce(sum(${saleItems.quantity}), 0)::int`,
        revenue: sql<string>`coalesce(sum(${saleItems.lineTotal}), 0)`,
      })
      .from(saleItems)
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .where(sql`${sales.clientId} = ${id} and ${sales.status} = 'completed'`)
      .groupBy(saleItems.productId, saleItems.productName, saleItems.imageUrl)
      .orderBy(desc(sql`sum(${saleItems.quantity})`))
      .limit(6);

    const salesTotal = num(agg?.total);
    const orders = agg?.orders ?? 0;
    const stats = {
      orders,
      total: salesTotal,
      avg: orders ? salesTotal / orders : 0,
      lastOrderAt: agg?.lastOrderAt ?? null,
      debt: Math.max(0, num(agg?.debt)),
    };

    return ok({
      client: {
        id: client.id,
        name: client.name,
        type: client.type,
        phone: client.phone,
        phone2: client.phone2 ?? "",
        address: client.address,
        notes: client.notes,
        createdAt: client.createdAt.toISOString(),
      },
      stats,
      favorites: favRows.map((f) => ({
        productId: f.productId,
        name: f.name,
        imageUrl: f.imageUrl,
        qty: f.qty,
        revenue: num(f.revenue),
      })),
      purchases,
    });
  } catch (e) {
    return errResponse(e);
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireUser();
  if (isErr(auth)) return auth.res;
  const { user } = auth;
  const isAdmin = user.role === "admin";
  const { id: rawId } = await ctx.params;
  const id = Math.trunc(num(rawId));
  if (!id) return bad("معرّف غير صالح");

  // الإعداد العام مفتاح master، ثم يُمنح الموظف صلاحية فردية من صفحة المستخدمين.
  if (!isAdmin) {
    const settings = await getAppSettings();
    if (!settings.allowUsersEditClients || !user.canEditClients)
      return bad(
        "تعديل بيانات العملاء يتطلب صلاحية المدير — اطلب من الماستر تفعيل الإعداد العام ثم منح صلاحية هذا الموظف",
        403,
      );
  }

  const body = await readBody<Record<string, unknown>>(req);
  if (!body) return bad("طلب غير صالح");

  await ensureSchema();
  try {
    const beforeRows = await db
      .select()
      .from(clients)
      .where(eq(clients.id, id))
      .limit(1);
    const before = beforeRows[0];
    if (!before) return bad("العميل غير موجود", 404);

    const nextPhone = cleanPhone(body.phone);
    const nextPhone2 = cleanPhone(body.phone2);

    // الموظف يصلح بيانات التواصل (الهاتف/الهاتف الثاني/العنوان/الملاحظات) فقط،
    // أما الاسم والنوع فيبقيان للمدير حفاظًا على هوية العميل وسجلاته.
    const name = isAdmin ? String(body.name ?? "").trim() : before.name;
    if (isAdmin && name.length < 2) return bad("اسم العميل مطلوب");
    const typeRaw = String(body.type ?? before.type);
    const type = (
      TYPE_VALUES.has(typeRaw) ? typeRaw : before.type
    ) as ClientType;
    const address = isAdmin
      ? String(body.address ?? "").trim().slice(0, 200)
      : before.address;
    const notes = isAdmin
      ? String(body.notes ?? "").trim().slice(0, 300)
      : before.notes;

    const changes: string[] = [];
    if (nextPhone !== before.phone)
      changes.push(
        `هاتف: "${before.phone || "—"}" ← "${nextPhone || "—"}"`,
      );
    if (nextPhone2 !== (before.phone2 ?? ""))
      changes.push(
        `هاتف 2: "${before.phone2 || "—"}" ← "${nextPhone2 || "—"}"`,
      );
    if (name !== before.name) changes.push(`الاسم ← "${name}"`);
    if (type !== before.type)
      changes.push(`النوع ← ${CLIENT_TYPES[type as ClientType]}`);
    if (address !== before.address) changes.push("العنوان");
    if (notes !== before.notes) changes.push("الملاحظات");

    if (!changes.length) return ok({ ok: true, unchanged: true });

    await db
      .update(clients)
      .set({ name: name.slice(0, 120), type, phone: nextPhone, phone2: nextPhone2, address, notes })
      .where(eq(clients.id, id));

    await logActivity(db, {
      userId: user.id,
      userName: user.name,
      action: "تعديل عميل",
      entity: "عميل",
      entityId: id,
      details: `${isAdmin ? "تعديل" : "تصحيح بيانات"} العميل "${
        before.name
      }" — ${changes.join(" • ")}`,
    });
    return ok({ ok: true });
  } catch (e) {
    return errResponse(e);
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = await requireUser();
  if (isErr(auth)) return auth.res;
  const { user } = auth;
  if (user.role !== "admin") return bad("حذف العملاء يتطلب صلاحية المدير", 403);
  const { id: rawId } = await ctx.params;
  const id = Math.trunc(num(rawId));
  if (!id) return bad("معرّف غير صالح");

  try {
    const countRows = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(sales)
      .where(eq(sales.clientId, id));
    if ((countRows[0]?.c ?? 0) > 0) {
      throw new BizError("لا يمكن حذف عميل لديه فواتير مسجلة — احتفظ بسجله", 409);
    }
    const rows = await db
      .delete(clients)
      .where(eq(clients.id, id))
      .returning({ name: clients.name });
    if (!rows[0]) return bad("العميل غير موجود", 404);
    await logActivity(db, {
      userId: user.id,
      userName: user.name,
      action: "حذف عميل",
      entity: "عميل",
      entityId: id,
      details: `حذف العميل "${rows[0].name}"`,
    });
    return ok({ ok: true });
  } catch (e) {
    return errResponse(e);
  }
}
