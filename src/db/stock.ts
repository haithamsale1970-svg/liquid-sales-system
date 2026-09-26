/**
 * إدارة وموازنة كميات المخزون.
 *
 * ★ لماذا هذا السكربت؟ حذف الفواتير لا يُرجِع المخزون تلقائيًا لأن `stock`
 *   عمود مخزّن (يُخصم وقت البيع) وليس محسوبًا من الحركات. فبعد حذف فواتير
 *   التست تبقى الكميات ناقصة. هذا السكربت يعيد ضبطها بشكل صريح ومُراقَب.
 *
 * الأوامر:
 *   npm run db:stock -- audit                  → عرض الحالة الحالية فقط (لا تعديل)
 *   npm run db:stock -- set <n> --yes          → ضبط كل الأصناف والمتغيرات على n
 *   npm run db:stock -- zero --yes             → تصفير كل المخزون
 *   npm run db:stock -- restore-seed --yes     → إرجاع كميات الأصناف التي أنشأها الـ seed
 *   npm run db:stock -- variant <id> <n> --yes → ضبط متغير واحد
 *
 * ملاحظة: `products.stock` يُستخدم فقط للأصناف **بدون** متغيرات؛ أما ذات
 *         المتغيرات فيُحسب المخزون المعروض من مجموع `product_variants.stock`.
 */
import { config as loadEnv } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq } from "drizzle-orm";
import { LOCAL_DATABASE_URL, buildPoolConfig, resolveDatabaseUrl } from "./connection";
import { products, productVariants } from "./schema";

loadEnv({ path: [".env.local", ".env"], quiet: true });

const resolved = resolveDatabaseUrl(true);
const pool = new Pool(buildPoolConfig(resolved?.url ?? LOCAL_DATABASE_URL));
const db = drizzle(pool);

/** كميات الأصناف كما أنشأها سكربت الـ seed (المصدر الوحيد للمقارنة). */
const SEED_STOCK: Record<string, number> = {
  "p-mango.jpg": 22,
  "p-mint.jpg": 31,
  "p-tobacco.jpg": 6,
  "p-berries.jpg": 17,
  "p-grape.jpg": 4,
};

const YES = process.argv.includes("--yes");
const args = process.argv.slice(2).filter((a) => a !== "--yes");
const cmd = args[0] ?? "audit";

async function run() {
  const pRows = await db
    .select({
      id: products.id,
      name: products.name,
      stock: products.stock,
      imageUrl: products.imageUrl,
    })
    .from(products)
    .orderBy(products.id);

  const vRows = await db
    .select({
      id: productVariants.id,
      productId: productVariants.productId,
      size: productVariants.size,
      nicotine: productVariants.nicotine,
      stock: productVariants.stock,
    })
    .from(productVariants)
    .orderBy(productVariants.id);

  const variantsBy = new Map<number, typeof vRows>();
  for (const v of vRows) {
    if (!variantsBy.has(v.productId)) variantsBy.set(v.productId, []);
    variantsBy.get(v.productId)!.push(v);
  }

  console.log("=".repeat(74));
  console.log(`  المخزون — ${cmd}${YES ? " (تنفيذ فعلي)" : " (معاينة)"}`);
  console.log("=".repeat(74));
  console.log(`المنتجات: ${pRows.length} · المتغيرات: ${vRows.length}\n`);

  let totalStock = 0;
  let zeroed = 0;
  for (const p of pRows) {
    const vs = variantsBy.get(p.id) ?? [];
    if (vs.length) {
      const sum = vs.reduce((a, v) => a + v.stock, 0);
      totalStock += sum;
      if (sum === 0) zeroed++;
      console.log(`#${p.id} ${p.name}  →  مجموع المتغيرات: ${sum}${sum === 0 ? "  ⚠️ صفر" : ""}`);
      for (const v of vs) console.log(`      · #${v.id} ${v.size} / ${v.nicotine}: ${v.stock}`);
    } else {
      totalStock += p.stock;
      if (p.stock === 0) zeroed++;
      console.log(`#${p.id} ${p.name}  →  ${p.stock}${p.stock === 0 ? "  ⚠️ صفر" : ""}`);
    }
  }
  console.log(`\nإجمالي القطع: ${totalStock} · أصناف عندها صفر مخزون: ${zeroed}`);

  const diffs: string[] = [];
  for (const p of pRows) {
    const key = Object.keys(SEED_STOCK).find((k) => (p.imageUrl ?? "").includes(k));
    if (!key) continue;
    const vs = variantsBy.get(p.id) ?? [];
    const current = vs.length ? vs.reduce((a, v) => a + v.stock, 0) : p.stock;
    if (current !== SEED_STOCK[key]) {
      diffs.push(`   ${p.name}: الحالي ${current} / الأصلي ${SEED_STOCK[key]}`);
    }
  }
  if (diffs.length) {
    console.log("\n— فروقات على أصناف الـ seed —");
    diffs.forEach((d) => console.log(d));
  }

  if (cmd === "audit" || !YES) {
    console.log("\n(وضع المعاينة — لم يُعدَّل شيء. أضف --yes مع أمر الضبط للتنفيذ.)");
    await pool.end();
    return;
  }

  console.log("\n→ جارٍ التنفيذ...");
  const client = await pool.connect();
  try {
    await client.query("begin");

    if (cmd === "zero") {
      await client.query("update product_variants set stock = 0");
      await client.query("update products set stock = 0");
      console.log("   ✓ تم تصفير كل المخزون");
    } else if (cmd === "set") {
      const n = Math.max(0, Math.trunc(Number(args[1])));
      if (!Number.isFinite(n)) throw new Error("قيمة غير صالحة — استخدم: set <رقم>");
      await client.query("update product_variants set stock = $1", [n]);
      await client.query("update products set stock = $1", [n]);
      console.log(`   ✓ تم ضبط كل المخزون على ${n}`);
    } else if (cmd === "variant") {
      const id = Math.trunc(Number(args[1]));
      const n = Math.max(0, Math.trunc(Number(args[2])));
      if (!Number.isFinite(n) || !id) throw new Error("استخدم: variant <id> <رقم>");
      const v = await db
        .select()
        .from(productVariants)
        .where(eq(productVariants.id, id))
        .limit(1);
      if (!v[0]) throw new Error(`المتغير #${id} غير موجود`);
      await db.update(productVariants).set({ stock: n }).where(eq(productVariants.id, id));
      console.log(`   ✓ المتغير #${id} (${v[0].size}/${v[0].nicotine}) = ${n}`);
    } else if (cmd === "restore-seed") {
      let done = 0;
      for (const p of pRows) {
        const key = Object.keys(SEED_STOCK).find((k) => (p.imageUrl ?? "").includes(k));
        if (!key) continue;
        const target = SEED_STOCK[key];
        const vs = variantsBy.get(p.id) ?? [];
        if (vs.length) {
          const each = Math.floor(target / vs.length);
          let rest = target - each * vs.length;
          for (const v of vs) {
            const give = each + (rest > 0 ? 1 : 0);
            if (rest > 0) rest--;
            await client.query("update product_variants set stock = $1 where id = $2", [give, v.id]);
          }
        } else {
          await client.query("update products set stock = $1 where id = $2", [target, p.id]);
        }
        console.log(`   ✓ ${p.name} = ${target}`);
        done++;
      }
      console.log(`   ✓ تمت استعادة ${done} صنف من الـ seed`);
    } else {
      throw new Error(`أمر غير معروف: ${cmd}`);
    }

    // مزامنة products.stock مع مجموع متغيراته
    await client.query(`
      update products p set stock = sub.total
      from (
        select product_id, sum(stock)::int as total
        from product_variants group by product_id
      ) sub
      where p.id = sub.product_id
    `);
    console.log("   ✓ تمت مزامنة مجاميع المخزون على مستوى الأصناف");

    await client.query("commit");
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }

  console.log("\n✓ تم.");
  await pool.end();
}

run()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("\n✗ فشلت العملية:", e instanceof Error ? e.message : e);
    process.exit(1);
  });

