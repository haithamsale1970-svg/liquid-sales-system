// إعدادات النظام العامة — تُقرأ من جدول app_settings (صف واحد id=1).
// تُستخدم من الـ API فقط (server). الواجهة تستقبل نسخة جاهزة عبر /api/settings.
import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  DEFAULT_SETTINGS,
  isCurrencyCode,
  type AppSettings,
} from "./currency";
import { num } from "./api";

function rowToSettings(r: typeof appSettings.$inferSelect): AppSettings {
  return {
    defaultCurrency: isCurrencyCode(r.defaultCurrency) ? r.defaultCurrency : "JOD",
    rateUSD: num(r.rateUsd) > 0 ? num(r.rateUsd) : DEFAULT_SETTINGS.rateUSD,
    rateEGP: num(r.rateEgp) > 0 ? num(r.rateEgp) : DEFAULT_SETTINGS.rateEGP,
    shippingInternal: num(r.shippingInternal) >= 0 ? num(r.shippingInternal) : 1.5,
    shippingExternal: num(r.shippingExternal) >= 0 ? num(r.shippingExternal) : 2,
    showReportsForUsers: r.showReportsForUsers,
    showClientsForUsers: r.showClientsForUsers,
    showProductsForUsers: r.showProductsForUsers,
    allowUsersEditClients: r.allowUsersEditClients,
  };
}

export async function getAppSettings(): Promise<AppSettings> {
  try {
    const rows = await db.select().from(appSettings).where(eq(appSettings.id, 1)).limit(1);
    if (rows[0]) return rowToSettings(rows[0]);
    await db.insert(appSettings).values({ id: 1 }).onConflictDoNothing();
    const again = await db.select().from(appSettings).where(eq(appSettings.id, 1)).limit(1);
    if (again[0]) return rowToSettings(again[0]);
  } catch {}
  return { ...DEFAULT_SETTINGS };
}
