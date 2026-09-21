import { sql } from "drizzle-orm";
import { db } from "@/db";
import { databaseEnvKey, describeDbError } from "@/db/connection";

export const dynamic = "force-dynamic";

/**
 * نقطة تشخيص سريعة: افتح /api/health في المتصفح لتعرف:
 *  - هل رابط قاعدة البيانات مضبوط؟ ومن أي متغيّر بيئة؟
 *  - هل الاتصال بـ Neon يعمل؟
 *  - هل الجداول مُنشأة؟
 * لا تُعرض أي بيانات سرّية (الرابط وكلمة المرور) هنا.
 */
function json(body: unknown) {
  return Response.json(body, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET() {
  const source = databaseEnvKey();

  if (!source) {
    return json({
      ok: false,
      database: "غير مضبوط",
      hint: "أضف DATABASE_URL (رابط Neon) في Vercel ← Settings ← Environment Variables ثم أعد النشر (Redeploy).",
      time: new Date().toISOString(),
    });
  }

  try {
    await db.execute(sql`select 1`);
  } catch (e) {
    console.error("[health] connection failed", e);
    return json({
      ok: false,
      database: "تعذّر الاتصال",
      envSource: source,
      error: describeDbError(e),
      time: new Date().toISOString(),
    });
  }

  try {
    await db.execute(sql`select 1 from "users" limit 1`);
  } catch (e) {
    console.error("[health] tables missing", e);
    return json({
      ok: false,
      database: "متصل",
      tables: "غير مهيّأة",
      envSource: source,
      error: describeDbError(e),
      hint: "افتح /api/setup?token=رمز-التهيئة لإنشاء الجداول، أو نفّذ npm run db:push.",
      time: new Date().toISOString(),
    });
  }

  return json({
    ok: true,
    database: "متصل",
    tables: "جاهزة",
    envSource: source,
    time: new Date().toISOString(),
  });
}

