import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  bad,
  errResponse,
  isErr,
  logActivity,
  num,
  ok,
  readBody,
  requireAdmin,
  requireUser,
} from "@/lib/api";
import { getAppSettings } from "@/lib/settings";
import { isCurrencyCode, DEFAULT_SETTINGS } from "@/lib/currency";
import { ensureSchema } from "@/lib/migrate";

export const dynamic = "force-dynamic";

// GET: أي مستخدم مسجّل يقرأ الإعدادات (العملة + التوصيل + الأقسام الظاهرة).
export async function GET() {
  const auth = await requireUser();
  if (isErr(auth)) return auth.res;
  await ensureSchema();
  try {
    return ok(await getAppSettings());
  } catch (e) {
    return errResponse(e);
  }
}

// PUT: الأدمن فقط — تعديل كل الأرقام والعملات والخصائص الظاهرة.
export async function PUT(req: Request) {
  const auth = await requireAdmin();
  if (isErr(auth)) return auth.res;
  const { user } = auth;
  const body = await readBody<Record<string, unknown>>(req);
  if (!body) return bad("طلب غير صالح");

  const def = body.defaultCurrency;
  const defaultCurrency = isCurrencyCode(def) ? def : DEFAULT_SETTINGS.defaultCurrency;
  const rateUsd = num(body.rateUSD);
  const rateEgp = num(body.rateEGP);
  const shipIn = num(body.shippingInternal);
  const shipEx = num(body.shippingExternal);
  if (!(rateUsd > 0) || !(rateEgp > 0)) return bad("أسعار الصرف يجب أن تكون أرقامًا موجبة");
  if (shipIn < 0 || shipEx < 0) return bad("أسعار التوصيل لا يمكن أن تكون سالبة");

  const showReportsForUsers = body.showReportsForUsers !== false;
  const showClientsForUsers = body.showClientsForUsers !== false;
  const showProductsForUsers = body.showProductsForUsers !== false;
  // صلاحية الموظفين في إضافة/تصحيح بيانات العملاء — تُفعَّل صراحةً (افتراضيًا مغلقة).
  const allowUsersEditClients = body.allowUsersEditClients === true;

  await ensureSchema();
  try {
    await db.insert(appSettings).values({ id: 1 }).onConflictDoNothing();
    await db
      .update(appSettings)
      .set({
        defaultCurrency,
        rateUsd: String(rateUsd),
        rateEgp: String(rateEgp),
        shippingInternal: String(shipIn),
        shippingExternal: String(shipEx),
        showReportsForUsers,
        showClientsForUsers,
        showProductsForUsers,
        allowUsersEditClients,
        updatedAt: new Date(),
      })
      .where(eq(appSettings.id, 1));
    await logActivity(db, {
      userId: user.id,
      userName: user.name,
      action: "تعديل إعدادات",
      entity: "نظام",
      entityId: 1,
      details: `تحديث العملات والأسعار (${defaultCurrency} — USD:${rateUsd} EGP:${rateEgp} — توصيل ${shipIn}/${shipEx}) • صلاحية الموظفين بتعديل العملاء: ${
        allowUsersEditClients ? "مُفعَّلة" : "موقوفة"
      }`,
    });
    return ok(await getAppSettings());
  } catch (e) {
    return errResponse(e);
  }
}


