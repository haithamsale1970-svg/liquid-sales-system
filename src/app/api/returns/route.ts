import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { clients, products, productVariants, returnItems, returns, saleItems, sales } from "@/db/schema";
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

type Line = {
  productId: number;
  saleItemId?: number;
  variantId?: number | null;
  priceType?: string;
  quantity: number;
};

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
        reason: r.ret.reason,
        note: r.ret.note,
        createdAt: r.ret.createdAt.toISOString(),
        items: items
          .filter((i) => i.returnId === r.ret.id)
          .map((i) => ({
            productId: i.productId,
            saleItemId: i.saleItemId,
            variantId: i.variantId,
            productName: i.productName,
            size: i.size,
            nicotine: i.nicotine,
            priceType: i.priceType === "wholesale" ? "wholesale" : "retail",
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
    reason?: string;
    note?: string;
    method?: string;
  }>(req);
  if (!body) return bad("طلب غير صالح");
  const saleId = Math.trunc(num(body.saleId));
  if (!saleId) return bad("معرّف الفاتورة غير صالح");

  const returned = (Array.isArray(body.returned) ? body.returned : [])
    .map((l) => ({
      productId: Math.trunc(num(l.productId)),
      saleItemId: Math.trunc(num(l.saleItemId)) || undefined,
      variantId: l.variantId == null ? null : Math.trunc(num(l.variantId)),
      priceType: l.priceType === "wholesale" ? "wholesale" : "retail",
      quantity: Math.trunc(num(l.quantity)),
    }))
    .filter((l) => l.productId > 0 && l.quantity > 0);
  const exchange = (Array.isArray(body.exchange) ? body.exchange : [])
    .map((l) => ({
      productId: Math.trunc(num(l.productId)),
      variantId: l.variantId == null ? null : Math.trunc(num(l.variantId)),
      priceType: l.priceType === "wholesale" ? "wholesale" : "retail",
      quantity: Math.trunc(num(l.quantity)),
    }))
    .filter((l) => l.productId > 0 && l.quantity > 0);
  if (!returned.length && !exchange.length)
    return bad("حدد أصناف الإرجاع أو الاستبدال أولاً");
  const reason = String(body.reason ?? "").trim().slice(0, 200);
  if (!reason) return bad("سبب الإرجاع أو الاستبدال مطلوب");
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
          saleItemId: returnItems.saleItemId,
          productId: returnItems.productId,
          variantId: returnItems.variantId,
          qty: returnItems.quantity,
        })
        .from(returnItems)
        .innerJoin(returns, eq(returnItems.returnId, returns.id))
        .where(and(eq(returns.saleId, saleId), eq(returnItems.direction, "in")));
      const prior = new Map<number, number>();
      for (const r of priorRows) {
        if (r.saleItemId !== null) {
          prior.set(r.saleItemId, (prior.get(r.saleItemId) ?? 0) + r.qty);
        }
      }

      // التحقق من الكميات + قيمة المرتجع بسعر الفاتورة الأصلي، مع الرجوع لسطر البيع.
      let retValue = 0;
      const resolvedReturned: Array<{
        line: (typeof returned)[number];
        item: (typeof sold)[number];
      }> = [];
      for (const l of returned) {
        const item = l.saleItemId
          ? sold.find((s) => s.id === l.saleItemId)
          : sold.find(
              (s) =>
                s.productId === l.productId &&
                (l.variantId === null ? s.variantId === null : s.variantId === l.variantId),
            );
        if (!item || item.productId !== l.productId)
          throw new BizError("أحد أصناف الإرجاع غير موجود في الفاتورة");
        if (item.variantId !== l.variantId)
          throw new BizError(`تفاصيل الصنف لا تطابق سطر الفاتورة: "${item.productName}"`);
        const allowed = item.quantity - (prior.get(item.id) ?? 0);
        if (l.quantity > allowed)
          throw new BizError(
            `لا يمكن إرجاع ${l.quantity} من "${item.productName}" — المسموح ${Math.max(0, allowed)} فقط`,
          );
        prior.set(item.id, (prior.get(item.id) ?? 0) + l.quantity);
        resolvedReturned.push({ line: l, item });
        retValue += num(item.price) * l.quantity;
      }

      const pids = [...new Set([...returned, ...exchange].map((l) => l.productId))];
      const prodRows = pids.length
        ? await tx
            .select()
            .from(products)
            .where(inArray(products.id, pids))
            .for("update")
        : [];
      const prodMap = new Map(prodRows.map((p) => [p.id, p]));

      const allVariants = pids.length
        ? await tx
            .select()
            .from(productVariants)
            .where(inArray(productVariants.productId, pids))
            .for("update")
        : [];
      const allVariantMap = new Map(allVariants.map((v) => [v.id, v]));

      let exchValue = 0;
      const deltaMap = new Map<number, number>();
      const exchangeResolved: Array<{
        line: (typeof exchange)[number];
        product: (typeof prodRows)[number];
        variant: (typeof allVariants)[number] | null | undefined;
        price: number;
        cost: number;
      }> = [];
      const exchangeReserved = new Map<string, number>();
      for (const l of returned)
        deltaMap.set(l.productId, (deltaMap.get(l.productId) ?? 0) + l.quantity);
      for (const l of exchange) {
        const p = prodMap.get(l.productId);
        const v = l.variantId === null ? null : allVariantMap.get(l.variantId);
        if (!p || p.archived)
          throw new BizError("أحد أصناف الاستبدال لم يعد متاحًا");
        if (l.variantId === null && allVariants.some((v) => v.productId === p.id && v.active))
          throw new BizError("اختر المقاس والنيكوتين لصنف الاستبدال");
        if (l.variantId !== null && (!v || !v.active || v.productId !== p.id))
          throw new BizError("تفاصيل صنف الاستبدال غير صالحة");
        const available = v ? v.stock : p.stock;
        const returnedSame = returned
          .filter((r) => (v ? r.variantId === v.id : r.variantId === null && r.productId === p.id))
          .reduce((sum, r) => sum + r.quantity, 0);
        const reservationKey = v ? `variant:${v.id}` : `product:${p.id}`;
        const reserved = exchangeReserved.get(reservationKey) ?? 0;
        const effectiveAvailable = available + returnedSame - reserved;
        if (effectiveAvailable < l.quantity)
          throw new BizError(
            `الكمية غير متاحة من "${p.name}"${v ? ` (${v.size} / ${v.nicotine})` : ""} — المتاح ${Math.max(0, effectiveAvailable)}`,
          );
        exchangeReserved.set(reservationKey, reserved + l.quantity);
        const price = v
          ? l.priceType === "wholesale"
            ? num(v.wholesalePrice)
            : num(v.retailPrice)
          : num(p.price);
        const cost = v ? num(v.cost) : num(p.cost);
        deltaMap.set(l.productId, (deltaMap.get(l.productId) ?? 0) - l.quantity);
        exchangeResolved.push({
          line: l,
          product: p,
          variant: v,
          price,
          cost,
        });
        exchValue += price * l.quantity;
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
          reason,
          note,
        })
        .returning({ id: returns.id });
      const returnId = retRows[0].id;

      await tx.insert(returnItems).values([
        ...resolvedReturned.map(({ line: l, item }) => ({
          returnId,
          saleItemId: item.id,
          productId: item.productId,
          variantId: item.variantId,
          size: item.size,
          nicotine: item.nicotine,
          priceType: item.priceType === "wholesale" ? "wholesale" : "retail",
          productName: item.productName,
          price: f2(num(item.price)),
          cost: f2(num(item.cost)),
          quantity: l.quantity,
          direction: "in",
        })),
        ...exchangeResolved.map(({ line: l, product: p, variant: v, price, cost }) => ({
          returnId,
          saleItemId: null,
          productId: p.id,
          variantId: l.variantId,
          size: v?.size ?? "",
          nicotine: v?.nicotine ?? "",
          priceType: l.priceType === "wholesale" ? "wholesale" : "retail",
          productName: p.name,
          price: f2(price),
          cost: f2(cost),
          quantity: l.quantity,
          direction: "out",
        })),
      ]);

      // تطبيق المخزون: المرتجع يدخل أولًا ثم يخرج بديل الاستبدال.
      const running = new Map(prodRows.map((p) => [p.id, p.stock]));
      const runningVariants = new Map(allVariants.map((v) => [v.id, v.stock]));
      for (const { line: l, item } of resolvedReturned) {
        const after = (running.get(item.productId) ?? 0) + l.quantity;
        running.set(item.productId, after);
        await tx
          .update(products)
          .set({ stock: after, updatedAt: new Date() })
          .where(eq(products.id, item.productId));
        let variantAfter: number | undefined;
        if (item.variantId !== null) {
          variantAfter = (runningVariants.get(item.variantId) ?? 0) + l.quantity;
          runningVariants.set(item.variantId, variantAfter);
          await tx
            .update(productVariants)
            .set({ stock: variantAfter, updatedAt: new Date() })
            .where(eq(productVariants.id, item.variantId));
        }
        await logMovement(tx, {
          productId: item.productId,
          variantId: item.variantId,
          size: item.size,
          nicotine: item.nicotine,
          priceType: item.priceType === "wholesale" ? "wholesale" : "retail",
          productName: item.productName,
          delta: l.quantity,
          stockAfter: variantAfter ?? after,
          reason: "مرتجع",
          refType: "return",
          refId: returnId,
          userId: user.id,
          userName: user.name,
          note: `${invoiceNo(saleId)} • السبب: ${reason}`,
        });
      }
      for (const { line: l, product: p, variant: v } of exchangeResolved) {
        const after = (running.get(p.id) ?? 0) - l.quantity;
        running.set(p.id, after);
        await tx
          .update(products)
          .set({ stock: after, updatedAt: new Date() })
          .where(eq(products.id, p.id));
        let variantAfter: number | undefined;
        if (l.variantId !== null) {
          variantAfter = (runningVariants.get(l.variantId) ?? 0) - l.quantity;
          runningVariants.set(l.variantId, variantAfter);
          await tx
            .update(productVariants)
            .set({ stock: variantAfter, updatedAt: new Date() })
            .where(eq(productVariants.id, l.variantId));
        }
        await logMovement(tx, {
          productId: p.id,
          variantId: l.variantId,
          size: v?.size ?? "",
          nicotine: v?.nicotine ?? "",
          priceType: l.priceType === "wholesale" ? "wholesale" : "retail",
          productName: p.name,
          delta: -l.quantity,
          stockAfter: variantAfter ?? after,
          reason: "استبدال",
          refType: "return",
          refId: returnId,
          userId: user.id,
          userName: user.name,
          note: `${invoiceNo(saleId)} • السبب: ${reason}`,
        });
      }

      await logActivity(tx, {
        userId: user.id,
        userName: user.name,
        action:
          returned.length && exchange.length ? "استبدال" : returned.length ? "مرتجع" : "استبدال",
        entity: "مرتجع",
        entityId: returnId,
        details: `فاتورة ${invoiceNo(saleId)} — ${returned.length} مرتجع / ${exchange.length} بديل — السبب: ${reason}${
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