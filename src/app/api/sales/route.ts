import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { clients, products, saleItems, sales, users } from "@/db/schema";
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
  type DbOrTx,
} from "@/lib/api";
import { f2 } from "@/lib/products";
import { invoiceNo, type SaleListDTO } from "@/lib/shared";

export const dynamic = "force-dynamic";

function dayStart(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export async function GET(req: Request) {
  const auth = await requireUser();
  if (isErr(auth)) return auth.res;
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const clientId = Math.trunc(num(url.searchParams.get("clientId")));
  const status = url.searchParams.get("status");
  const page = Math.max(1, Math.trunc(num(url.searchParams.get("page"))) || 1);
  const pageSize = 15;

  const conds = [];
  if (from) {
    const d = new Date(from);
    if (!isNaN(d.getTime())) conds.push(gte(sales.createdAt, dayStart(d)));
  }
  if (to) {
    const d = new Date(to);
    if (!isNaN(d.getTime())) {
      const end = dayStart(d);
      end.setDate(end.getDate() + 1);
      conds.push(lt(sales.createdAt, end));
    }
  }
  if (clientId) conds.push(eq(sales.clientId, clientId));
  if (status === "completed" || status === "cancelled")
    conds.push(eq(sales.status, status));
  const where = conds.length ? and(...conds) : undefined;

  try {
    const countRows = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(sales)
      .where(where);
    const totalCount = countRows[0]?.c ?? 0;

    const rows = await db
      .select({
        id: sales.id,
        clientId: sales.clientId,
        status: sales.status,
        subtotal: sales.subtotal,
        shippingType: sales.shippingType,
        shippingCost: sales.shippingCost,
        total: sales.total,
        profit: sales.profit,
        createdAt: sales.createdAt,
        clientName: clients.name,
        clientType: clients.type,
        userName: users.name,
      })
      .from(sales)
      .innerJoin(clients, eq(sales.clientId, clients.id))
      .innerJoin(users, eq(sales.userId, users.id))
      .where(where)
      .orderBy(desc(sales.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const ids = rows.map((r) => r.id);
    const aggs = ids.length
      ? await db
          .select({
            saleId: saleItems.saleId,
            itemsCount: sql<number>`count(*)::int`,
            unitsCount: sql<number>`coalesce(sum(${saleItems.quantity}), 0)::int`,
          })
          .from(saleItems)
          .where(inArray(saleItems.saleId, ids))
          .groupBy(saleItems.saleId)
      : [];
    const aggMap = new Map(aggs.map((a) => [a.saleId, a]));

    const data: SaleListDTO[] = rows.map((r) => ({
      id: r.id,
      clientId: r.clientId,
      clientName: r.clientName,
      clientType: r.clientType,
      userName: r.userName,
      status: r.status,
      subtotal: num(r.subtotal),
      shippingType: r.shippingType,
      shippingCost: num(r.shippingCost),
      total: num(r.total),
      profit: num(r.profit),
      itemsCount: aggMap.get(r.id)?.itemsCount ?? 0,
      unitsCount: aggMap.get(r.id)?.unitsCount ?? 0,
      createdAt: r.createdAt.toISOString(),
    }));

    return ok({
      data,
      page,
      pageSize,
      totalCount,
      pages: Math.max(1, Math.ceil(totalCount / pageSize)),
    });
  } catch (e) {
    return errResponse(e);
  }
}

type SaleItemInput = { productId?: number; quantity?: number };

export async function POST(req: Request) {
  const auth = await requireUser();
  if (isErr(auth)) return auth.res;
  const { user } = auth;

  const body = await readBody<{
    clientId?: number;
    items?: SaleItemInput[];
    shippingType?: string;
    shippingCost?: number;
    notes?: string;
  }>(req);
  if (!body) return bad("طلب غير صالح");

  const clientId = Math.trunc(num(body.clientId));
  if (!clientId) return bad("اختر العميل أولاً");

  // merge duplicate products
  const wanted = new Map<number, number>();
  for (const it of Array.isArray(body.items) ? body.items : []) {
    const pid = Math.trunc(num(it.productId));
    const qty = Math.trunc(num(it.quantity));
    if (pid > 0 && qty > 0) wanted.set(pid, (wanted.get(pid) ?? 0) + qty);
  }
  if (!wanted.size) return bad("أضف صنفًا واحدًا على الأقل للفاتورة");

  const shippingType = ["none", "internal", "external"].includes(
    body.shippingType ?? "",
  )
    ? (body.shippingType as "none" | "internal" | "external")
    : "none";
  const shippingCost =
    shippingType === "none" ? 0 : Math.max(0, num(body.shippingCost));

  try {
    const saleId = await db.transaction(async (tx: DbOrTx) => {
      const clientRows = await tx
        .select()
        .from(clients)
        .where(eq(clients.id, clientId))
        .limit(1);
      const client = clientRows[0];
      if (!client) throw new BizError("العميل غير موجود", 404);

      const ids = [...wanted.keys()];
      const rows = await tx
        .select()
        .from(products)
        .where(inArray(products.id, ids))
        .for("update");

      let subtotal = 0;
      let profit = 0;
      const lines: Array<{
        saleId?: number;
        productId: number;
        productName: string;
        imageUrl: string;
        price: string;
        cost: string;
        quantity: number;
        lineTotal: string;
      }> = [];

      for (const [pid, qty] of wanted) {
        const p = rows.find((r) => r.id === pid);
        if (!p || p.archived)
          throw new BizError("أحد الأصناف المطلوبة لم يعد متاحًا");
        if (p.stock < qty)
          throw new BizError(
            `الكمية المطلوبة من "${p.name}" غير متاحة — المتبقي ${p.stock} فقط`,
          );
        const price = num(p.price);
        const cost = num(p.cost);
        subtotal += price * qty;
        profit += (price - cost) * qty;
        lines.push({
          productId: pid,
          productName: p.name,
          imageUrl: p.imageUrl,
          price: f2(price),
          cost: f2(cost),
          quantity: qty,
          lineTotal: f2(price * qty),
        });
        await tx
          .update(products)
          .set({
            stock: sql`${products.stock} - ${qty}`,
            updatedAt: new Date(),
          })
          .where(eq(products.id, pid));
      }

      const total = subtotal + shippingCost;
      const saleRows = await tx
        .insert(sales)
        .values({
          clientId,
          userId: user.id,
          subtotal: f2(subtotal),
          shippingType,
          shippingCost: f2(shippingCost),
          total: f2(total),
          profit: f2(profit),
          notes: String(body.notes ?? "").slice(0, 400),
        })
        .returning({ id: sales.id });
      const saleId = saleRows[0].id;
      await tx
        .insert(saleItems)
        .values(lines.map((l) => ({ ...l, saleId })));
      await logActivity(tx, {
        userId: user.id,
        userName: user.name,
        action: "إنشاء فاتورة",
        entity: "فاتورة",
        entityId: saleId,
        details: `فاتورة ${invoiceNo(saleId)} للعميل "${client.name}" بقيمة ${f2(
          total,
        )} (${lines.length} صنف)`,
      });
      return saleId;
    });

    return ok({ id: saleId }, { status: 201 });
  } catch (e) {
    return errResponse(e);
  }
}
