/**
 * طبقة الوصول لبيانات الصلاحيات (server only).
 * تقرأ وتكتب جدول user_permissions وتحوّله إلى خريطة صلاحيات جاهزة.
 */
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { userPermissions } from "@/db/schema";
import {
  allPermissions,
  normalizePermissions,
  permissionsFromList,
  type PermissionKey,
  type Permissions,
} from "./permissions";

/** يقرأ كل مفاتيح الصلاحيات الممنوحة للمستخدم ويحوّلها لخريطة. */
export async function loadUserPermissions(userId: number): Promise<Permissions> {
  const rows = await db
    .select({ permKey: userPermissions.permKey })
    .from(userPermissions)
    .where(eq(userPermissions.userId, userId));
  return permissionsFromList(rows.map((r) => r.permKey));
}

/**
 * الصلاحيات الفعلية للمستخدم.
 *
 * نمط "آمن افتراضيًا" (fail-closed): المدير يملك كل شيء، وغير المدير
 * يحصل على خريطة فارغة عند أي مشكلة بدل رمي استثناء.Empty map = لا
 * صلاحيات = الواجهة تعرض شاشة "لا تملك صلاحية" بدل الشاشة السوداء.
 */
export async function resolvePermissions(
  userId: number,
  role: "admin" | "user",
): Promise<Permissions> {
  if (role === "admin") return allPermissions();
  try {
    return await loadUserPermissions(userId);
  } catch (e) {
    // لا نُسقط الجلسة: جدول الصلاحيات غير متاح (قاعدة لم تُرقَّ بعد)
    // أو فشل استعلام مؤقت. نمنع كل شيء بدل منح صلاحيات بالخطأ.
    console.error("[rbac] failed to load permissions for user", userId, e);
    return {};
  }
}

/**
 * يستبدل صلاحيات مستخدم بالكامل داخل معاملة واحدة.
 * النتيجة = الصفوف التي ستُحذف ثم الصفوف التي ستُضاف.
 */
export async function replaceUserPermissions(
  userId: number,
  input: unknown,
): Promise<{ granted: PermissionKey[]; removed: string[] }> {
  const next = normalizePermissions(input);
  const granted = Object.keys(next).filter((k) => next[k]) as PermissionKey[];

  return db.transaction(async (tx) => {
    const current = await tx
      .select({ permKey: userPermissions.permKey })
      .from(userPermissions)
      .where(eq(userPermissions.userId, userId));

    const currentKeys = new Set(current.map((c) => c.permKey));
    const nextKeys = new Set<string>(granted);

    const toDelete = [...currentKeys].filter((k) => !nextKeys.has(k));
    if (toDelete.length) {
      await tx
        .delete(userPermissions)
        .where(
          and(
            eq(userPermissions.userId, userId),
            inArray(userPermissions.permKey, toDelete),
          ),
        );
    }

    const toAdd = granted.filter((k) => !currentKeys.has(k));
    if (toAdd.length) {
      await tx
        .insert(userPermissions)
        .values(toAdd.map((permKey) => ({ userId, permKey })));
    }

    return { granted, removed: toDelete };
  });
}
