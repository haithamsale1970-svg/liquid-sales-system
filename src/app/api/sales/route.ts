import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { clients, products, productVariants, saleItems, sales, users } from "@/db/schema";
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
import { getAppSettings } from "@/lib/settings";
import { isCurrencyCode } from "@/lib/currency";
import { logMovement } from "@/lib/inventory";
import {
  PAYMENT_METHODS,
  invoiceNo,
  isPaymentMethod,
  type PaymentMethod,
  type PriceType,
  type SaleListDTO,
} from "@/lib/shared";

export const dynamic = "force-dynamic";

function dayStart(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export async function GET(req: Request) {
  const auth = await requireUser();
  if (isErr(auth)) return auth.res;
  const isAdmin = auth.user.role === "admin";
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
        deliveryReceivable: sales.deliveryReceivable,
        profit: sales.profit,
        currency: sales.currency,
        rate: sales.rate,
        paymentMethod: sales.paymentMethod,
        discount: sales.discount,
        paid: sales.paid,
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
      deliveryReceivable: num(r.deliveryReceivable),
      // الربح للأدمن فقط — المستخدم العادي يرى إجمالي المبيعات فقط.
      profit: isAdmin ? num(r.profit) : 0,
      currency: (r.currency as string) ?? "JOD",
      rate: num(r.rate) || 1,
      itemsCount: aggMap.get(r.id)?.itemsCount ?? 0,
      unitsCount: aggMap.get(r.id)?.unitsCount ?? 0,
      paymentMethod: isPaymentMethod(r.paymentMethod) ? r.paymentMethod : "cash",
      discount: num(r.discount),
      paid: r.paid === null ? num(r.total) : num(r.paid),
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

type SaleItemInput = {
  productId?: number;
  variantId?: number | null;
  quantity?: number;
  priceType?: string;
};

export async function POST(req: Request) {
  const auth = await requireUser();
  if (isErr(auth)) return auth.res;
  const { user } = auth;

  const body = await readBody<{
    clientId?: number;
    items?: SaleItemInput[];
    shippingType?: string;
    shippingCost?: number;
    paymentMethod?: string;
    discountType?: string;
    discountValue?: number;
    paid?: number | string;
    currency?: string;
    notes?: string;
  }>(req);
  if (!body) return bad("طلب غير صالح");

  const clientId = Math.trunc(num(body.clientId));
  if (!clientId) return bad("اختر العميل أولاً");

  // merge duplicate lines by product + variant + price type
  const wanted = new Map<
    string,
    { productId: number; variantId: number | null; priceType: PriceType; quantity: number }
  >();
  for (const it of Array.isArray(body.items) ? body.items : []) {
    const pid = Math.trunc(num(it.productId));
    const vid = it.variantId == null ? null : Math.trunc(num(it.variantId));
    const qty = Math.trunc(num(it.quantity));
    const priceType: PriceType = it.priceType === "wholesale" ? "wholesale" : "retail";
    if (pid > 0 && qty > 0) {
      const key = `${pid}:${vid ?? "base"}:${priceType}`;
      const current = wanted.get(key);
      wanted.set(key, {
        productId: pid,
        variantId: vid,
        priceType,
        quantity: (current?.quantity ?? 0) + qty,
      });
    }
  }
  if (!wanted.size) return bad("أضف صنفًا واحدًا على الأقل للفاتورة");

  const shippingType = ["none", "internal", "external"].includes(
    body.shippingType ?? "",
  )
    ? (body.shippingType as "none" | "internal" | "external")
    : "none";
  // طريقة الدفع + خصم الفاتورة (الخصم للأدمن فقط — يُتجاهل من المستخدم العادي).
  const requestedPaymentMethod: PaymentMethod = isPaymentMethod(body.paymentMethod)
    ? body.paymentMethod
    : "cash";
  const paymentMethod: PaymentMethod = shippingType !== "none"
    ? "delivery"
    : requestedPaymentMethod;
  if (paymentMethod === "credit" && user.role !== "admin") {
    return bad("خيار آجل (ذمة العميل) متاح للمدير فقط", 403);
  }
  const isDeliverySale = shippingType !== "none" && paymentMethod === "delivery";
  const discountType = ["none", "percent", "amount"].includes(
    String(body.discountType ?? "none"),
  )
    ? String(body.discountType ?? "none")
    : "none";
  const discountValue = Math.max(0, num(body.discountValue));
  const paidRaw =
    body.paid === undefined || body.paid === null || body.paid === ""
      ? null
      : Math.max(0, num(body.paid));
  // التوصيل ثابت من إعدادات الأدمن (داخلي 1.5 / خارجي 2 افتراضيًا) — يُتجاهل أي رقم قادم من الواجهة.
  const settings = await getAppSettings();
  const shippingCost =
    shippingType === "none"
      ? 0
      : shippingType === "internal"
        ? settings.shippingInternal
        : settings.shippingExternal;
  const currency = isCurrencyCode((body as Record<string, unknown>).currency)
    ? ((body as Record<string, unknown>).currency as "JOD" | "USD" | "EGP")
    : settings.defaultCurrency;
  const rate = currency === "JOD" ? 1 : currency === "USD" ? settings.rateUSD : settings.rateEGP;

  try {
    const saleId = await db.transaction(async (tx: DbOrTx) => {
      const clientRows = await tx
        .select()
        .from(clients)
        .where(eq(clients.id, clientId))
        .limit(1);
      const client = clientRows[0];
      if (!client) throw new BizError("العميل غير موجود", 404);

      const productIds = [...new Set([...wanted.values()].map((w) => w.productId))];
      const rows = await tx
        .select()
        .from(products)
        .where(inArray(products.id, productIds))
        .for("update");
      const variantRows = productIds.length
        ? await tx
            .select()
            .from(productVariants)
            .where(inArray(productVariants.productId, productIds))
            .for("update")
        : [];
      const variantMap = new Map(variantRows.map((v) => [v.id, v]));
      const productsWithActiveVariants = new Set(
        variantRows.filter((v) => v.active).map((v) => v.productId),
      );
      const productStockAfter = new Map<number, number>();
      const variantStockAfter = new Map<number, number>();

      let subtotal = 0;
      const stockAfterMap = new Map<string, number>();
      let profit = 0;
      const lines: Array<{
        saleId?: number;
        lineKey: string;
        productId: number;
        variantId: number | null;
        productName: string;
        imageUrl: string;
        size: string;
        nicotine: string;
        priceType: PriceType;
        price: string;
        cost: string;
        quantity: number;
        lineTotal: string;
      }> = [];

      for (const [lineKey, requested] of wanted) {
        const { productId: pid, variantId, priceType, quantity: qty } = requested;
        const p = rows.find((r) => r.id === pid);
        if (!p || p.archived)
          throw new BizError("أحد الأصناف المطلوبة لم يعد متاحًا");
        if (variantId === null && productsWithActiveVariants.has(pid))
          throw new BizError(`اختر الحجم والنيكوتين للمنتج "${p.name}"`);
        const variant = variantId === null ? null : variantMap.get(variantId);
        if (variantId !== null && (!variant || !variant.active || variant.productId !== pid))
          throw new BizError("تفاصيل المنتج المختارة غير صالحة");
        const availableStock = variant
          ? (variantStockAfter.get(variant.id) ?? variant.stock)
          : (productStockAfter.get(pid) ?? p.stock);
        if (availableStock < qty)
          throw new BizError(
            `الكمية المطلوبة من "${p.name}"${variant ? ` (${variant.size} / ${variant.nicotine})` : ""} غير متاحة — المتبقي ${availableStock} فقط`,
          );
        const price = variant
          ? priceType === "wholesale"
            ? num(variant.wholesalePrice)
            : num(variant.retailPrice)
          : num(p.price);
        const cost = variant ? num(variant.cost) : num(p.cost);
        if (variant && price <= 0)
          throw new BizError(`سعر ${priceType === "wholesale" ? "الجملة" : "الأفراد"} للصنف المحدد غير صالح`);
        subtotal += price * qty;
        profit += (price - cost) * qty;
        const size = variant?.size ?? "";
        const nicotine = variant?.nicotine ?? "";
        lines.push({
          lineKey,
          productId: pid,
          variantId,
          productName: p.name,
          imageUrl: p.imageUrl,
          size,
          nicotine,
          priceType,
          price: f2(price),
          cost: f2(cost),
          quantity: qty,
          lineTotal: f2(price * qty),
        });
        if (variant) {
          const nextVariantStock = (variantStockAfter.get(variant.id) ?? variant.stock) - qty;
          variantStockAfter.set(variant.id, nextVariantStock);
          await tx
            .update(productVariants)
            .set({ stock: nextVariantStock, updatedAt: new Date() })
            .where(eq(productVariants.id, variant.id));
          const nextProductStock = (productStockAfter.get(pid) ?? p.stock) - qty;
          productStockAfter.set(pid, nextProductStock);
          await tx
            .update(products)
            .set({ stock: nextProductStock, updatedAt: new Date() })
            .where(eq(products.id, pid));
          stockAfterMap.set(lineKey, nextVariantStock);
        } else {
          const nextProductStock = (productStockAfter.get(pid) ?? p.stock) - qty;
          productStockAfter.set(pid, nextProductStock);
          await tx
            .update(products)
            .set({ stock: nextProductStock, updatedAt: new Date() })
            .where(eq(products.id, pid));
          stockAfterMap.set(lineKey, nextProductStock);
        }
      }

      // الخصم (للأدمن فقط): نسبة من الفرعي أو مبلغ ثابت — يُخصم من الإجمالي ويقلل الربح.
      let discount = 0;
      if (user.role === "admin") {
        if (discountType === "percent")
          discount = Math.min(subtotal, (subtotal * discountValue) / 100);
        else if (discountType === "amount")
          discount = Math.min(subtotal + shippingCost, discountValue);
      }
      const total = Math.max(0, subtotal + shippingCost - discount);
      const finalProfit = profit - discount;
      // مثبّت حسابي: ذمة شركة التوصيل = الإجمالي النهائي - سعر التوصيل.
      const deliveryReceivable = isDeliverySale
        ? Math.max(0, total - shippingCost)
        : 0;
      // مستحقات شركة التوصيل: يدفع المُستحق سعر التوصيل فقط، والباقي يبقى بذمتها.
      const paidDefault = isDeliverySale ? shippingCost : paymentMethod === "credit" ? 0 : total;
      const paid = isDeliverySale
        ? Math.min(total, shippingCost)
        : Math.min(total, paidRaw === null ? paidDefault : paidRaw);
      const saleRows = await tx
        .insert(sales)
        .values({
          clientId,
          userId: user.id,
          subtotal: f2(subtotal),
          shippingType,
          shippingCost: f2(shippingCost),
          total: f2(total),
          deliveryReceivable: f2(deliveryReceivable),
          profit: f2(finalProfit),
          paymentMethod,
          discount: f2(discount),
          paid: f2(paid),
          currency,
          rate: String(rate),
          notes: String(body.notes ?? "").slice(0, 400),
        })
        .returning({ id: sales.id });
      const saleId = saleRows[0].id;
      await tx.insert(saleItems).values(
        lines.map(({ lineKey: _lineKey, ...line }) => ({ ...line, saleId })),
      );
      // سجل حركات المخزون — خروج كل صنف مع الرصيد بعد البيع.
      for (const l of lines) {
        await logMovement(tx, {
          productId: l.productId,
          variantId: l.variantId,
          size: l.size,
          nicotine: l.nicotine,
          priceType: l.priceType,
          productName: l.productName,
          delta: -l.quantity,
          stockAfter: stockAfterMap.get(l.lineKey) ?? 0,
          reason: "بيع",
          refType: "sale",
          refId: saleId,
          userId: user.id,
          userName: user.name,
          note: invoiceNo(saleId),
        });
      }
      await logActivity(tx, {
        userId: user.id,
        userName: user.name,
        action: "إنشاء فاتورة",
        entity: "فاتورة",
        entityId: saleId,
        details: `فاتورة ${invoiceNo(saleId)} للعميل "${client.name}" بقيمة ${f2(
          total,
        )} (${lines.length} صنف) — ${PAYMENT_METHODS[paymentMethod]}${
          paid < total ? ` • المتبقي ${f2(total - paid)}` : " • مدفوعة بالكامل"
        }${discount > 0 ? ` • خصم ${f2(discount)}` : ""}${
          isDeliverySale ? ` • ذمة شركة التوصيل ${f2(deliveryReceivable)}` : ""
        }`,
      });
      return saleId;
    });

    return ok({ id: saleId }, { status: 201 });
  } catch (e) {
    return errResponse(e);
  }
}
