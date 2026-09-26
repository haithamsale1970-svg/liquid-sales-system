/**
 * تفريغ المعاملات التجريبية والانتقال من مرحلة التست إلى العمل الفعلي.
 *
 * ★ الوضع الافتراضي (آمن): يحذف **المعاملات فقط** —
 *   المرتجعات، سداد الديون، دفعات التقسيط، بنود الفواتير، الفواتير،
 *   المصاريف، حركات المخزون، سجل النشاط.
 *   ★★ لا يُمَس أبدًا: المنتجات ومتغيراتها وخصائصها (الكتالوج)، العملاء،
 *      المستخدمون + كلمات المرور + الأدوار، الجلسات، إعدادات النظام.
 *
 * التشغيل:
 *   npm run db:reset            → معاينة (لا يحذف شيئًا)
 *   npm run db:reset -- --yes   → تنفيذ تفريغ المعاملات (آمن)
 *   npm run db:reset -- --all --yes → تصفير كامل يشمل الكتالوج (خطير)
 */
import { config as loadEnv } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  LOCAL_DATABASE_URL,
  buildPoolConfig,
  resolveDatabaseUrl,
} from "./connection";
import {
  activityLogs,
  clients,
  clientPayments,
  expenses,
  inventoryMovements,
  productFields,
  products,
  productVariants,
  returnItems,
  returns,
  saleItems,
  sales,
  users,
} from "./schema";

loadEnv({ path: [".env.local", ".env"], quiet: true });

const resolved = resolveDatabaseUrl(true);
const url = resolved?.url ?? LOCAL_DATABASE_URL;
const pool = new Pool(buildPoolConfig(url));
const db = drizzle(pool);

/**
 * جداول تُحذف، مرتبة بحيث تُحذف الأبناء قبل الآباء.
 *
 * scope = "transactions" (الافتراضي الآمن):
 *   معاملات البيع فقط — الفواتير ومرتجعاتها ودفعاتها ودفعات التقسيط
 *   والمصاريف وحركات المخزون وسجل النشاط.
 *   ★ الكتالوج (products / product_variants / product_fields) والعملاء
 *     لا يُمَسّون إطلاقًا.
 *
 * scope = "all" (عند تمرير --all):
 *   تصفير كامل يشمل الكتالوج والعملاء — للاستخدام قبل العمل الفعلي فقط.
 */
const ALL_TABLES: ReadonlyArray<{ name: string; label: string; scope: "tx" | "all" }> = [
  { name: "return_items", label: "بنود المرتجعات", scope: "tx" },
  { name: "returns", label: "المرتجعات والاستبدال", scope: "tx" },
  { name: "client_payments", label: "سداد الديون", scope: "tx" },
  { name: "sale_installments", label: "دفعات التقسيط", scope: "tx" },
  { name: "sale_items", label: "بنود الفواتير", scope: "tx" },
  { name: "sales", label: "الفواتير", scope: "tx" },
  { name: "expenses", label: "المصاريف", scope: "tx" },
  { name: "inventory_movements", label: "حركات المخزون", scope: "tx" },
  { name: "activity_logs", label: "سجل النشاط", scope: "tx" },
  { name: "product_variants", label: "خيارات المنتجات (المتغيرات)", scope: "all" },
  { name: "product_fields", label: "خصائص المنتجات", scope: "all" },
  { name: "products", label: "المنتجات والأصناف", scope: "all" },
  { name: "clients", label: "العملاء", scope: "all" },
];

/** جداول محفوظة في كل الأحوال (غير قابلة للحذف بهذه الأداة). */
const PRESERVED: ReadonlyArray<{ name: string; label: string }> = [
  { name: "users", label: "المستخدمون وكلمات المرور والأدوار" },
  { name: "sessions", label: "جلسات الدخول" },
  { name: "app_settings", label: "إعدادات النظام" },
];

const FULL_WIPE = process.argv.includes("--all");
const TABLES = ALL_TABLES.filter((t) => (FULL_WIPE ? true : t.scope === "tx"));

/** جداول المعرّفات التي يُعاد ضبط عدّاداتها لتبدأ من 1. */
const SERIAL_TABLES = TABLES.map((t) => t.name);


/** ينفّذ SQL خامًا ويُرجع الصفوف وعدد الصفوف المتأثرة. */
async function sql<T = Record<string, unknown>>(query: string) {
  const res = await pool.query(query);
  return { rows: res.rows as T[], rowCount: res.rowCount ?? 0 };
}

async function main() {
  console.log("=".repeat(66));
  console.log(
    FULL_WIPE
      ? "  تصفير كامل لقاعدة البيانات (يشمل الكتالوج والعملاء)"
      : "  تفريغ المعاملات التجريبية (الكتالوج والعملاء محفوظة)",
  );
  console.log("=".repeat(66));
  console.log(
    resolved
      ? `→ قاعدة البيانات من المتغيّر ${resolved.key}`
      : "→ لا يوجد متغيّر بيئة — قاعدة بيانات محلية على 127.0.0.1",
  );

  // ---------- 1) المستخدمون: يُفحصون أولاً ولا يُمسّون ----------
  const before = await db
    .select({ id: users.id, username: users.username, role: users.role })
    .from(users);
  const adminCount = before.filter((u) => u.role === "admin").length;

  console.log(`\n✓ المستخدمون (لن يُمَسّ): ${before.length}`);
  for (const u of before) console.log(`   - #${u.id} ${u.username} (${u.role})`);

  if (!adminCount) {
    console.error(
      "\n✗ لا يوجد أي مدير (admin) — تم الإيقاف لحماية بيانات الدخول.",
    );
    await pool.end();
    process.exit(1);
  }

  // ---------- 2) معاينة ما سيُحذف ----------
  console.log("\n— السجلات التي سيتم حذفها —");
  let total = 0;
  for (const t of TABLES) {
    const { rows } = await sql<{ c: number }>(
      `select count(*)::int as c from ${t.name}`,
    );
    const c = Number(rows[0]?.c ?? 0);
    total += c;
    console.log(`   ${c === 0 ? "·" : "✗"} ${t.label} (${t.name}): ${c}`);
  }
  console.log(`\nإجمالي السجلات المحذوفة: ${total}`);

  // تأكيد صريح: ما لن يُمَسّ
  console.log("\n— لن يُمَسّ —");
  for (const p of PRESERVED) {
    const { rows } = await sql<{ c: number }>(
      `select count(*)::int as c from ${p.name}`,
    );
    console.log(`   ✓ ${p.label} (${p.name}): ${Number(rows[0]?.c ?? 0)}`);
  }
  const kept = ALL_TABLES.filter((t) => !TABLES.includes(t));
  for (const k of kept) {
    const { rows } = await sql<{ c: number }>(
      `select count(*)::int as c from ${k.name}`,
    );
    console.log(`   ✓ ${k.label} (${k.name}): ${Number(rows[0]?.c ?? 0)}`);
  }

  if (total === 0) {
    console.log("\n✓ لا توجد بيانات تجريبية — القاعدة نظيفة بالفعل.");
    await pool.end();
    process.exit(0);
  }


  // ---------- 3) تأكيد صريح قبل التنفيذ ----------
  if (process.argv[2] !== "--yes") {
    console.log(
      "\nلتنفيذ التصفير فعليًا أعد تشغيل الأمر مع الوسيط --yes:\n" +
        "  npm run db:reset -- --yes",
    );
    await pool.end();
    process.exit(0);
  }

  // ---------- 4) الحذف داخل معاملة واحدة (الأبناء قبل الآباء) ----------
  console.log("\n→ جارٍ الحذف داخل معاملة واحدة...");
  const client = await pool.connect();
  try {
    await client.query("begin");
    for (const t of TABLES) {
      const res = await client.query(`delete from ${t.name}`);
      console.log(`   ✓ ${t.label}: حُذف ${res.rowCount ?? 0}`);
    }
    // إعادة ضبط العدّادات لتبدأ أرقام الفواتير والأصناف من 1
    for (const table of SERIAL_TABLES) {
      await client.query(
        `select setval(pg_get_serial_sequence('${table}', 'id'), 1, false)`,
      );
    }
    console.log("   ✓ تم ضبط العدّادات لتبدأ من 1");
    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }

  // ---------- 5) التحقق النهائي ----------
  console.log("\n→ التحقق النهائي...");
  const failures: string[] = [];
  for (const t of TABLES) {
    const { rows } = await sql<{ c: number }>(
      `select count(*)::int as c from ${t.name}`,
    );
    const c = Number(rows[0]?.c ?? 0);
    if (c !== 0) failures.push(`${t.name} ما زال يحتوي ${c} صف`);
  }

  const after = await db
    .select({ id: users.id, username: users.username, role: users.role })
    .from(users);
  if (after.length !== before.length) {
    failures.push(
      `عدد المستخدمين تغيّر (قبل ${before.length} / بعد ${after.length})`,
    );
  }
  for (const b of before) {
    const same = after.some(
      (a) => a.id === b.id && a.username === b.username && a.role === b.role,
    );
    if (!same) failures.push(`الحساب ${b.username} (${b.role}) لم يعد مطابقًا`);
  }
  const settings = await sql<{ c: number }>(
    "select count(*)::int as c from app_settings",
  );
  console.log(`   ✓ إعدادات النظام: ${settings.rows[0]?.c ?? 0} صف (لم تُمس)`);

  if (failures.length) {
    console.error("\n✗ فشل التحقق:");
    for (const f of failures) console.error(`   - ${f}`);
    await pool.end();
    process.exit(1);
  }

  console.log("✓ كل الجداول المطلوب تصفيرها فارغة تمامًا.");
  console.log(`✓ المستخدمون كما هم: ${after.length} حساب (${adminCount} مدير).`);
  console.log("\n" + "=".repeat(66));
  console.log("  تمت التصفية بنجاح — النظام جاهز للعمل الفعلي");
  console.log("=".repeat(66));
  await pool.end();
  process.exit(0);
}

main().catch(async (e) => {
  console.error("\n✗ فشل التصفير:", e instanceof Error ? e.message : e);
  try {
    await pool.end();
  } catch {
    /* تجاهل */
  }
  process.exit(1);
});
