import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { clients, products, returnItems, returns, saleItems, sales } from "@/db/schema";
import {
  BizError,
  bad,
  errResponse,
  isErr,
  logActivity,
  num,
  ok,
  readBody,
  requireAdmin,
  type DbOrTx,
} from "@/lib/api";
import { logMovement } from "@/lib/inventory";
import { f2 } from "@/lib/products";
import { invoiceNo, isPaymentMethod, type PaymentMethod } from "@/lib/shared";

export const dynamic = "force-dynamic";

type Line = { productId: number; quantity: number };

// قائمة المرتجعات (الأدمن فقط).
export async function GET() {
  const auth = await requireAdmin();
  if (isErr(auth)) return auth.res;
  try {
    const rows = await db
      .select({ ret: returns, clientName: clients.name })
      .from(returns)
      .innerJoin(clients, eq(returns.clientId, clients.id))
      .orderBy(desc(returns.createdAt))
      .limit(200);
    const ids = rows.map((r) => r.ret.id);
    const items = ids.length
      ? await db.select().from(returnItems).where(inArray(returnItems.returnId, ids))
      : [];
    return ok(
      rows.map((r) => ({
        id: r.ret.id,
        saleId: r.ret.saleId,
        clientName: r.clientName,
        userName: r.ret.userName,
        refund: num(r.ret.refund),
        method: r.ret.method,
        note: r.ret.note,
        createdAt: r.ret.createdAt.toISOString(),
        items: items
          .filter((i) => i.returnId === r.ret.id)
          .map((i) => ({
            productId: i.productId,
            productName: i.productName,
            price: num(i.price),
            cost: num(i.cost),
            quantity: i.quantity,
            direction: (i.direction === "out" ? "out" : "in") as "in" | "out",
          })),
      })),
    );
  } catch (e) {
    return errResponse(e);
  }
}

// إنشاء مرتجع/استبدال على فاتورة مكتملة — يعدّل المخزون وحساب العميل تلقائيًا.
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (isErr(auth)) return auth.res;
  const { user } = auth;

  const body = await readBody<{
    saleId?: number;
    returned?: Line[];
    exchange?: Line[];
    note?: string;
    method?: string;
  }>(req);
  if (!body) return bad("طلب غير صالح");
  const saleId = Math.trunc(num(body.saleId));
  if (!saleId) return bad("معرّف الفاتورة غير صالح");

  const returned = (Array.isArray(body.returned) ? body.returned : [])
    .map((l) => ({
      productId: Math.trunc(num(l.productId)),
      quantity: Math.trunc(num(l.quantity)),
    }))
    .filter((l) => l.productId > 0 && l.quantity > 0);
  const exchange = (Array.isArray(body.exchange) ? body.exchange : [])
    .map((l) => ({
      productId: Math.trunc(num(l.productId)),
      quantity: Math.trunc(num(l.quantity)),
    }))
    .filter((l) => l.productId > 0 && l.quantity > 0);
  if (!returned.length && !exchange.length)
    return bad("حدد أصناف الإرجاع أو الاستبدال أولاً");
  const note = String(body.note ?? "").slice(0, 200);
  const method: PaymentMethod = isPaymentMethod(body.method) ? body.method : "cash";

  try {
    const result = await db.transaction(async (tx: DbOrTx) => {
      const saleRows = await tx
        .select()
        .from(sales)
        .where(eq(sales.id, saleId))
        .for("update")
        .limit(1);
      const sale = saleRows[0];
      if (!sale) throw new BizError("الفاتورة غير موجودة", 404);
      if (sale.status !== "completed")
        throw new BizError("لا يمكن عمل مرتجع على فاتورة ملغاة");

      const sold = await tx
        .select()
        .from(saleItems)
        .where(eq(saleItems.saleId, saleId));
      const priorRows = await tx
        .select({
          productId: returnItems.productId,
          qty: sql<number>`coalesce(sum(${returnItems.quantity}), 0)::int`,
        })
        .from(returnItems)
        .innerJoin(returns, eq(returnItems.returnId, returns.id))
        .where(and(eq(returns.saleId, saleId), eq(returnItems.direction, "in")))
        .groupBy(returnItems.productId);
      const prior = new Map(priorRows.map((r) => [r.productId, r.qty]));

      // التحقق من الكميات + قيمة المرتجع بسعر الفاتورة الأصلي.
      let retValue = 0;
      for (const l of returned) {
        const item = sold.find((s) => s.productId === l.productId);
        if (!item) throw new BizError("أحد الأصناف غير موجود في الفاتورة");
        const allowed = item.quantity - (prior.get(l.productId) ?? 0);
        if (l.quantity > allowed)
          throw new BizError(
            `لا يمكن إرجاع ${l.quantity} من "${item.productName}" — المسموح ${Math.max(0, allowed)} فقط`,
          );
        retValue += num(item.price) * l.quantity;
      }

      const pids = [...new Set([...returned, ...exchange].map((l) => l.productId))];
      const prodRows = await tx
        .select()
        .from(products)
        .where(inArray(products.id, pids))
        .for("update");
      const prodMap = new Map(prodRows.map((p) => [p.id, p]));

      let exchValue = 0;
      const deltaMap = new Map<number, number>();
      for (const l of returned)
        deltaMap.set(l.productId, (deltaMap.get(l.productId) ?? 0) + l.quantity);
      for (const l of exchange) {
        const p = prodMap.get(l.productId);
        if (!p || p.archived)
          throw new BizError("أحد أصناف الاستبدال لم يعد متاحًا");
        const delta = deltaMap.get(l.productId) ?? 0;
        if (p.stock + delta < l.quantity)
          throw new BizError(
            `الكمية غير متافية من "${p.name}" — المتاح ${Math.max(0, p.stock + delta)}`,
          );
        deltaMap.set(l.productId, delta - l.quantity);
        exchValue += num(p.price) * l.quantity;
      }
      for (const [pid, delta] of deltaMap) {
        const p = prodMap.get(pid);
        if (p && p.stock + delta < 0)
          throw new BizError(`الرصيد لا يمكن أن يصبح سالبًا لـ "${p.name}"`);
      }

      const netRefund = retValue - exchValue;

      const retRows = await tx
        .insert(returns)
        .values({
          saleId,
          clientId: sale.clientId,
          userId: user.id,
          userName: user.name,
          refund: f2(netRefund),
          method,
          note,
        })
        .returning({ id: returns.id });
      const returnId = retRows[0].id;

      await tx.insert(returnItems).values([
        ...returned.map((l) => {
          const item = sold.find((s) => s.productId === l.productId)!;
          return {
            returnId,
            productId: l.productId,
            productName: item.productName,
            price: f2(num(item.price)),
            cost: f2(num(item.cost)),
            quantity: l.quantity,
            direction: "in",
          };
        }),
        ...exchange.map((l) => {
          const p = prodMap.get(l.productId)!;
          return {
            returnId,
            productId: l.productId,
            productName: p.name,
            price: f2(num(p.price)),
            cost: f2(num(p.cost)),
            quantity: l.quantity,
            direction: "out",
          };
        }),
      ]);

      // تطبيق المخزون: المرتجع يدخل أولًا ثم يخرج بديل الاستبدال.
      const running = new Map(prodRows.map((p) => [p.id, p.stock]));
      for (const l of returned) {
        const after = (running.get(l.productId) ?? 0) + l.quantity;
        running.set(l.productId, after);
        await tx
          .update(products)
          .set({ stock: after, updatedAt: new Date() })
          .where(eq(products.id, l.productId));
        await logMovement(tx, {
          productId: l.productId,
          productName:
            sold.find((s) => s.productId === l.productId)?.productName ?? "",
          delta: l.quantity,
          stockAfter: after,
          reason: "مرتجع",
          refType: "return",
          refId: returnId,
          userId: user.id,
          userName: user.name,
          note: invoiceNo(saleId),
        });
      }
      for (const l of exchange) {
        const after = (running.get(l.productId) ?? 0) - l.quantity;
        running.set(l.productId, after);
        await tx
          .update(products)
          .set({ stock: after, updatedAt: new Date() })
          .where(eq(products.id, l.productId));
        await logMovement(tx, {
          productId: l.productId,
          productName: prodMap.get(l.productId)?.name ?? "",
          delta: -l.quantity,
          stockAfter: after,
          reason: "استبدال",
          refType: "return",
          refId: returnId,
          userId: user.id,
          userName: user.name,
          note: invoiceNo(saleId),
        });
      }

      await logActivity(tx, {
        userId: user.id,
        userName: user.name,
        action:
          returned.length && exchange.length ? "استبدال" : returned.length ? "مرتجع" : "استبدال",
        entity: "مرتجع",
        entityId: returnId,
        details: `فاتورة ${invoiceNo(saleId)} — ${returned.length} مرتجع / ${exchange.length} بديل${
          netRefund !== 0 ? ` • الفرق ${f2(netRefund)}` : " • بدون فرق مالي"
        }${note ? ` — ${note}` : ""}`,
      });

      return { id: returnId, refund: netRefund };
    });
    return ok(result, { status: 201 });
  } catch (e) {
    return errResponse(e);
  }
}