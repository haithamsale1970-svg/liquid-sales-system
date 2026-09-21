import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import {
  DB_CONFIG_ERROR_PREFIX,
  buildPoolConfig,
  resolveDatabaseUrl,
} from "./connection";

// يُخزَّن التجمّع على globalThis حتى لا تتكرر الاتصالات أثناء التطوير المحلي
// (Hot Reload) أو عند إعادة استخدام نفس نسخة الدالة على Vercel.
const globalForDb = globalThis as typeof globalThis & {
  __sohobPool?: Pool;
};

function createPool(): Pool {
  const resolved = resolveDatabaseUrl();
  if (!resolved) {
    throw new Error(
      DB_CONFIG_ERROR_PREFIX +
        "لم يتم ضبط رابط قاعدة البيانات. أضف المتغيّر DATABASE_URL (رابط Neon) من: " +
        "Vercel ← المشروع ← Settings ← Environment Variables، ثم أعد النشر (Redeploy). " +
        "أو شغّل التهيئة من /api/setup?token=... إن كنت قد أضفت رمز التهيئة.",
    );
  }
  return new Pool(buildPoolConfig(resolved.url));
}

/**
 * تجمّع اتصالات PostgreSQL. لا يُنشأ الاتصال إلا عند أول استعلام فعلي،
 * لذلك لا يتوقف `next build` على Vercel إذا لم تُضبط المتغيّرات بعد.
 */
export function getPool(): Pool {
  if (!globalForDb.__sohobPool) globalForDb.__sohobPool = createPool();
  return globalForDb.__sohobPool;
}

function createDb() {
  return drizzle(getPool(), { schema });
}

let cachedDb: ReturnType<typeof createDb> | undefined;

function realDb(): ReturnType<typeof createDb> {
  if (!cachedDb) cachedDb = createDb();
  return cachedDb;
}

/**
 * كائن قاعدة البيانات المستخدم في كل مسارات الـ API.
 * مبني على Proxy حتى يتم إنشاء الاتصال بشكل كسول عند أول استخدام فقط،
 * مع بقاء نفس الأنواع (Types) ونفس طريقة الاستخدام: db.select() / db.transaction().
 */
export const db = new Proxy({} as ReturnType<typeof createDb>, {
  get(_target, prop) {
    const target = realDb() as unknown as Record<string | symbol, unknown>;
    const value = target[prop];
    return typeof value === "function" ? value.bind(target) : value;
  },
});

