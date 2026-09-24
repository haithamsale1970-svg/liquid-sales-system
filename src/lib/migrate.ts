/**
 * ترقية خفيفة وتلقائية لبنية قاعدة البيانات.
 *
 * تُنفَّذ مرة واحدة فقط لكل نسخة من السيرفر (memoized) وتحتوي على أوامر
 * «إضافة» آمنة للتكرار (ADD COLUMN IF NOT EXISTS) حتى لا تتعطّل واجهات
 * النظام إذا كانت قاعدة البيانات منشأة قبل إضافة الأعمدة الجديدة.
 * لا تحذف ولا تعدّل أي بيانات — وإن فشلت لا توقف الطلب (تُسجَّل فقط).
 */
import { getPool } from "@/db";
import { SCHEMA_SQL } from "@/db/schemaSql";

let done: Promise<void> | null = null;

/**
 * ينشئ/يحدّث الجداول المطلوبة قبل أول عملية محمية.
 * SCHEMA_SQL آمن للتكرار ولا يحذف بيانات، لذلك يعمل على قاعدة Neon جديدة
 * وعلى قواعد الإصدارات السابقة معًا. لا نتجاهل الأخطاء: العملية التي تحتاج
 * جدولًا جديدًا يجب أن تفشل برسالة واضحة بدل أن تبدو ناجحة بلا أثر.
 */
export function ensureSchema(): Promise<void> {
  if (!done) {
    done = (async () => {
      await getPool().query(SCHEMA_SQL);
    })().catch((error) => {
      done = null;
      throw error;
    });
  }
  return done;
}
