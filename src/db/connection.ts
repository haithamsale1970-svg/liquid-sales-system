import type { PoolConfig } from "pg";

/**
 * إعدادات الاتصال بقاعدة البيانات (PostgreSQL / Neon).
 *
 * هذا الملف مستقل عن Next.js حتى تستخدمه:
 *  - التطبيق نفسه (src/db/index.ts)
 *  - سكربتات drizzle-kit (drizzle.config.ts)
 *  - سكربت التهيئة (src/db/seed.ts)
 */

/** تُستخدم كبادئة لرسائل أخطاء الإعداد حتى نعرضها للمستخدم كما هي. */
export const DB_CONFIG_ERROR_PREFIX = "[DB-CONFIG] ";

/** الرابط المحلي الافتراضي (للتطوير على الجهاز فقط). */
export const LOCAL_DATABASE_URL =
  "postgresql://postgres:postgres@127.0.0.1:5432/app_db";

/**
 * أسماء متغيّرات البيئة التي قد تحتوي رابط قاعدة البيانات.
 * تكاملة Neon الرسمية مع Vercel تضيف أكثر من اسم، لذلك نجربها بالترتيب.
 * الأولوية للرابط المجمّع (Pooled) وقت تشغيل التطبيق.
 */
export const DB_URL_KEYS_APP = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "NEON_DATABASE_URL",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
  "POSTGRES_PRISMA_URL",
  "PG_URL",
] as const;

/**
 * نفس القائمة لكن بأولوية للرابط المباشر (غير المجمّع) لأن أوامر
 * تحديث المخطط (drizzle-kit push) وبذر البيانات تفضّل اتصالًا مباشرًا.
 */
export const DB_URL_KEYS_TOOLING = [
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
  "DATABASE_URL",
  "POSTGRES_URL",
  "NEON_DATABASE_URL",
  "POSTGRES_PRISMA_URL",
  "PG_URL",
] as const;

export type ResolvedDatabase = { key: string; url: string };

function isPostgresUrl(value: string): boolean {
  return /^postgres(ql)?:\/\//i.test(value);
}

export function readEnv(name: string): string | undefined {
  const raw = process.env[name];
  if (typeof raw !== "string") return undefined;
  const value = raw.trim();
  return value ? value : undefined;
}

/**
 * يرجع رابط قاعدة البيانات واسم المتغيّر، أو null إذا لم يُضبط أي متغيّر.
 * يرمي خطأً عربيًا واضحًا إذا كان المتغيّر موجودًا لكن قيمته ليست رابط PostgreSQL.
 */
export function resolveDatabaseUrl(
  preferDirect = false,
): ResolvedDatabase | null {
  const keys = preferDirect ? DB_URL_KEYS_TOOLING : DB_URL_KEYS_APP;
  for (const key of keys) {
    const value = readEnv(key);
    if (!value) continue;
    if (!isPostgresUrl(value)) {
      throw new Error(
        DB_CONFIG_ERROR_PREFIX +
          `المتغيّر ${key} موجود لكن قيمته ليست رابط PostgreSQL صحيحًا. ` +
          `يجب أن يبدأ الرابط بـ postgresql:// (انسخه من Neon ← Connection Details).`,
      );
    }
    return { key, url: value };
  }
  return null;
}

export function isLocalDatabase(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "::1" ||
    h === "0.0.0.0" ||
    h.endsWith(".local") ||
    h === "host.docker.internal"
  );
}

/**
 * يبني إعدادات pg.Pool من رابط الاتصال.
 *
 * ملاحظة مهمة: في نسخ pg الحديثة (8.13+) تتجاهل المكتبة خيار ssl الذي
 * نمرّره إذا احتوى الرابط على sslmode، وتفسّر sslmode=require على أنه
 * verify-full، وهذا يسبّب الخطأ "self-signed certificate in certificate
 * chain" مع Neon. لذلك نحذف إعدادات SSL من الرابط ونتحكم بها من هنا
 * (اتصال مشفّر دائمًا + إمكانية تمكين التحقق الكامل من الشهادة).
 */
export function buildPoolConfig(url: string): PoolConfig {
  const parsed = new URL(url);

  // نحذف كل ما يتعلق بـ SSL من الرابط حتى لا يتغلّب على إعداداتنا.
  for (const key of [
    "sslmode",
    "ssl",
    "sslcert",
    "sslkey",
    "sslrootcert",
    "uselibpqcompat",
    "channel_binding",
  ]) {
    parsed.searchParams.delete(key);
  }

  const ca = readEnv("DATABASE_CA_CERT") ?? readEnv("PGSSLROOTCERT");
  const strict = readEnv("DB_SSL_STRICT") === "true";
  const local = isLocalDatabase(parsed.hostname);

  let ssl: PoolConfig["ssl"];
  if (local) {
    // قاعدة بيانات محلية (تطوير) بدون TLS.
    ssl = undefined;
  } else if (ca) {
    // شهادة CA مُمرّرة (الأفضل أمنيًا) → تحقق كامل.
    ssl = { ca, rejectUnauthorized: true };
  } else if (strict) {
    // تحقق كامل مقابل شهادات النظام.
    ssl = { rejectUnauthorized: true };
  } else {
    // Neon وباقي مزوّدي Postgres المُدار: اتصال مشفّر دائمًا مع تعطيل
    // التحقق من الشهادة حتى لا يفشل الاتصال على Vercel.
    // لتمكين التحقق: أضف DATABASE_CA_CERT أو DB_SSL_STRICT=true.
    ssl = { rejectUnauthorized: false };
  }

  const maxRaw = Number.parseInt(readEnv("PG_POOL_MAX") ?? "", 10);

  return {
    connectionString: parsed.toString(),
    ssl,
    // عدد الاتصالات لكل نسخة من الدالة على Vercel (serverless) — صغير عن قصد.
    max: Number.isFinite(maxRaw) && maxRaw > 0 ? maxRaw : 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 15_000,
    allowExitOnIdle: true,
    application_name: "sohob-liquids",
  };
}

/** هل يوجد متغيّر بيئة صالح لرابط قاعدة البيانات؟ */
export function databaseEnvKey(preferDirect = false): string | null {
  try {
    return resolveDatabaseUrl(preferDirect)?.key ?? null;
  } catch {
    return null;
  }
}

/**
 * ترجمة أخطاء قاعدة البيانات إلى رسالة عربية مفهومة لصاحب النظام.
 * التفاصيل التقنية تُطبع في سجلات Vercel (Logs) فقط.
 */
export function describeDbError(error: unknown): string {
  const err = error as { code?: unknown; message?: unknown } | null | undefined;
  const code = typeof err?.code === "string" ? err.code : "";
  const message = String(err?.message ?? error ?? "");
  const lower = message.toLowerCase();

  // رسائلنا الخاصة بالإعداد تُعرض كما هي.
  if (message.includes(DB_CONFIG_ERROR_PREFIX)) {
    return message.split(DB_CONFIG_ERROR_PREFIX)[1] ?? message;
  }

  if (code === "42P01") {
    return "جداول قاعدة البيانات غير موجودة بعد. شغّل تهيئة قاعدة البيانات: افتح /api/setup?token=... أو نفّذ npm run db:push.";
  }
  if (code === "42703" || code === "42P07") {
    return "بنية قاعدة البيانات قديمة وغير متوافقة مع الكود. نفّذ npm run db:push لتحديث المخطط.";
  }
  if (code === "28P01") {
    return "كلمة مرور قاعدة البيانات غير صحيحة. انسخ رابط الاتصال من Neon من جديد وحدّث DATABASE_URL في Vercel.";
  }
  if (code === "28000") {
    return "سيرفر قاعدة البيانات رفض بيانات الدخول. تأكد أن رابط Neon كامل (المستخدم + كلمة المرور).";
  }
  if (code === "3D000") {
    return "قاعدة البيانات المذكورة في الرابط غير موجودة في Neon. انسخ رابط الاتصال الصحيح.";
  }
  if (code === "57P03" || lower.includes("starting up")) {
    return "قاعدة بيانات Neon كانت متوقفة وتعمل الآن على التشغيل (Cold Start). انتظر بضع ثوانٍ ثم أعد المحاولة.";
  }
  if (code === "53300" || lower.includes("too many clients")) {
    return "عدد الاتصالات بقاعدة البيانات كبير. استخدم رابط Neon المجمّع (Pooled) الذي يحتوي على -pooler في المضيف.";
  }
  if (code === "ENOTFOUND") {
    return "اسم مضيف قاعدة البيانات غير صحيح (رابط Neon غير مكتمل أو فيه خطأ مطبعي).";
  }
  if (code === "ECONNREFUSED") {
    return "سيرفر قاعدة البيانات رفض الاتصال. تأكد أن مشروع Neon في حالة تشغيل وأن الرابط صحيح.";
  }
  if (
    code === "ETIMEDOUT" ||
    lower.includes("timeout") ||
    lower.includes("timed out")
  ) {
    return "انتهت مدة الاتصال بقاعدة البيانات. جرّب رابط Neon المجمّع (Pooled) ثم أعد المحاولة.";
  }
  if (
    lower.includes("self-signed certificate") ||
    lower.includes("certificate") ||
    lower.includes("ssl")
  ) {
    return "تعذّر إنشاء اتصال مشفّر مع قاعدة البيانات (مشكلة شهادة SSL). تأكد أن الرابط يبدأ بـ postgresql:// وأنه من Neon.";
  }
  if (lower.includes("terminated") || lower.includes("econnreset")) {
    return "قُطع الاتصال بقاعدة البيانات قبل إتمام العملية. أعد المحاولة، وإن تكرّر استخدم رابط Neon المجمّع (-pooler).";
  }
  if (code === "22P02") {
    return "تم إرسال قيمة بغير صيغتها الصحيحة إلى قاعدة البيانات. أعد إدخال البيانات.";
  }
  if (code === "23505") {
    return "هذه القيمة مسجّلة مسبقًا (تكرار في بيانات يجب أن تكون فريدة).";
  }
  if (code === "23503") {
    return "لا يمكن تنفيذ العملية لوجود بيانات مرتبطة بها.";
  }
  return "حدث خطأ غير متوقع في الاتصال بقاعدة البيانات. راجع سجلات Vercel (Logs) لمعرفة التفاصيل.";
}
