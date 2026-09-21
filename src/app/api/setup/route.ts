import { eq } from "drizzle-orm";
import { db, getPool } from "@/db";
import { describeDbError, resolveDatabaseUrl } from "@/db/connection";
import { sessions, users } from "@/db/schema";
import { SCHEMA_SQL } from "@/db/schemaSql";
import { logActivity } from "@/lib/api";
import { hashPassword } from "@/lib/password";

export const dynamic = "force-dynamic";

/**
 * نقطة تهيئة النظام (تُفتح من المتصفح مرة واحدة):
 *
 *   /api/setup?token=الرمز                          → إنشاء الجداول + أول حساب مدير
 *   /api/setup?token=الرمز&resetPassword=كلمة-مرور  → تغيير كلمة المرور (إن نسيتها)
 *
 * محميّة بمتغيّر البيئة SETUP_TOKEN.
 * احذف SETUP_TOKEN من Vercel بعد الانتهاء لتعطيل هذه الصفحة نهائيًا.
 */

const HELP =
  "أضف متغيّرًا باسم SETUP_TOKEN في Vercel ← Settings ← Environment Variables " +
  "(قيمة من اختيارك، 8 أحرف أو أكثر) ثم أعد النشر (Redeploy).";

const LABELS: Record<string, string> = {
  message: "الرسالة",
  next: "الخطوة التالية",
  error: "سبب المشكلة",
  adminCreated: "هل تم إنشاء حساب المدير؟",
  admin: "بيانات حساب المدير",
  databaseSource: "مصدر رابط قاعدة البيانات",
  tables: "حالة الجداول",
  resetFor: "تم تغيير كلمة مرور",
};

function esc(v: unknown) {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** صفحة عربية واضحة عند الفتح من المتصفح، و JSON لأي أداة أخرى. */
function respond(req: Request, body: Record<string, unknown>, status = 200) {
  const accept = req.headers.get("accept") ?? "";
  if (!accept.includes("text/html")) {
    return Response.json(body, {
      status,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const ok = body.ok === true;
  const head = ok ? "#ff2b2b" : "#ff8b8b";
  const title = ok ? "تمت العملية بنجاح ✅" : "لم تكتمل العملية — راجع السبب التالي";
  const rows = Object.entries(body)
    .filter(([k]) => k !== "ok")
    .map(([k, v]) => {
      const label = LABELS[k] ?? k;
      const value =
        v !== null && typeof v === "object"
          ? JSON.stringify(v, null, 1)
          : String(v ?? "—");
      return `<tr><th>${esc(label)}</th><td>${esc(value)}</td></tr>`;
    })
    .join("");

  const html = `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>تهيئة نظام Cloud Culture</title></head>
<body style="margin:0;background:#050505;color:#ffffff;font-family:system-ui,'Segoe UI',Tahoma,sans-serif">
<div style="max-width:780px;margin:0 auto;padding:44px 22px">
  <h1 style="color:${head};font-size:27px;margin:0 0 8px">${title}</h1>
  <p style="color:#c9c9c9;font-size:14px;margin:0 0 24px">صفحة تهيئة قاعدة بيانات نظام Cloud Culture — يمكنك إغلاقها بعد قراءة النتيجة.</p>
  <table style="width:100%;border-collapse:collapse;font-size:15px;line-height:1.9">${rows}</table>
  <p style="margin-top:30px">
    <a href="/login" style="display:inline-block;background:linear-gradient(135deg,#ff2b2b,#8f0000);color:#ffffff;font-weight:800;text-decoration:none;padding:12px 22px;border-radius:12px">الانتقال إلى صفحة تسجيل الدخول ←</a>
  </p>
</div></body></html>`;

  return new Response(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function GET(req: Request) {
  return runSetup(req);
}

export async function POST(req: Request) {
  return runSetup(req);
}

async function runSetup(req: Request) {
  const expected = process.env.SETUP_TOKEN?.trim() ?? "";
  const url = new URL(req.url);
  const provided =
    url.searchParams.get("token") ?? req.headers.get("x-setup-token") ?? "";

  if (!expected) {
    return respond(
      req,
      { ok: false, error: `هذه الصفحة معطّلة. ${HELP}` },
      503,
    );
  }

  if (expected.length < 8) {
    return respond(
      req,
      {
        ok: false,
        error: "قيمة SETUP_TOKEN قصيرة جدًا — اجعلها 8 أحرف أو أكثر.",
      },
      503,
    );
  }

  if (provided !== expected) {
    return respond(req, { ok: false, error: "الرمز (token) غير صحيح." }, 401);
  }

  try {
    const resolved = resolveDatabaseUrl();
    if (!resolved) {
      return respond(
        req,
        {
          ok: false,
          error:
            "لا يوجد رابط قاعدة بيانات. أضف DATABASE_URL من Neon في Vercel ثم أعد النشر.",
        },
        500,
      );
    }

    // 1) إنشاء الجداول (آمن للتكرار: IF NOT EXISTS).
    await getPool().query(SCHEMA_SQL);

    // 2) إنشاء أول حساب مدير إذا لم يكن في النظام أي مستخدم.
    const existing = await db.select({ id: users.id }).from(users).limit(1);
    let adminCreated = false;
    if (!existing.length) {
      await db.insert(users).values({
        username: "admin",
        name: "مدير النظام",
        passwordHash: await hashPassword("admin123"),
        role: "admin",
      });
      adminCreated = true;
    }

    // 3) تغيير كلمة المرور (اختياري) — يفيدك إن نسيت كلمة مرور المدير.
    const newPassword = url.searchParams.get("resetPassword") ?? "";
    const targetUsername = (url.searchParams.get("user") ?? "admin")
      .trim()
      .toLowerCase();

    if (newPassword) {
      if (newPassword.length < 8) {
        return respond(
          req,
          {
            ok: false,
            error: "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل.",
          },
          400,
        );
      }

      const target = await db
        .select({ id: users.id, username: users.username })
        .from(users)
        .where(eq(users.username, targetUsername))
        .limit(1);

      if (!target.length) {
        return respond(
          req,
          { ok: false, error: `لا يوجد مستخدم باسم "${targetUsername}".` },
          404,
        );
      }

      await db
        .update(users)
        .set({ passwordHash: await hashPassword(newPassword) })
        .where(eq(users.id, target[0].id));

      // نُنهي كل جلسات هذا المستخدم حتى تُطبَّق كلمة المرور الجديدة.
      await db.delete(sessions).where(eq(sessions.userId, target[0].id));

      await logActivity(db, {
        userId: null,
        userName: "النظام",
        action: "تغيير كلمة مرور",
        entity: "نظام",
        details: `تم تغيير كلمة مرور المستخدم "${target[0].username}" من صفحة التهيئة`,
      });

      return respond(req, {
        ok: true,
        resetFor: target[0].username,
        message: `تم تغيير كلمة مرور "${target[0].username}" بنجاح.`,
        next: "سجّل الدخول بكلمة المرور الجديدة، ثم احذف SETUP_TOKEN من Vercel لتعطيل هذه الصفحة.",
      });
    }

    await logActivity(db, {
      userId: null,
      userName: "النظام",
      action: "تهيئة قاعدة البيانات",
      entity: "نظام",
      details: adminCreated
        ? "إنشاء الجداول وحساب المدير الأول"
        : "التحقق من وجود الجداول (كانت مهيّأة مسبقًا)",
    });

    return respond(req, {
      ok: true,
      message: adminCreated
        ? "قاعدة البيانات جاهزة، وتم إنشاء حساب المدير: admin / admin123"
        : "قاعدة البيانات جاهزة (لا يوجد تغيير لأن النظام كان مهيّأ مسبقًا).",
      tables: "جاهزة",
      adminCreated,
      admin: adminCreated ? { username: "admin", password: "admin123" } : null,
      databaseSource: resolved.key,
      next: "سجّل الدخول الآن، وغيّر كلمة المرور من صفحة الإعدادات، ثم احذف SETUP_TOKEN من Vercel.",
    });
  } catch (e) {
    console.error("[setup] failed", e);
    return respond(req, { ok: false, error: describeDbError(e) }, 500);
  }
}