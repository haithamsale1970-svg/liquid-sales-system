import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userPermissions, users } from "@/db/schema";
import {
  bad,
  errResponse,
  isErr,
  logActivity,
  num,
  ok,
  readBody,
  requirePermission,
} from "@/lib/api";
import type { PermissionKey } from "@/lib/permissions";
import { replaceUserPermissions } from "@/lib/rbac";
import { ensureSchema } from "@/lib/migrate";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** قراءة صلاحيات مستخدم واحد جاهزة للعرض في لوحة الأدمن. */
export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requirePermission("users.view");
  if (isErr(auth)) return auth.res;
  const { user } = auth;

  const { id: rawId } = await ctx.params;
  const id = Math.trunc(num(rawId));
  if (!id) return bad("معرّف غير صالح");

  try {
    await ensureSchema();
    const target = await db
      .select({ id: users.id, name: users.name, username: users.username, role: users.role })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (!target[0]) return bad("المستخدم غير موجود", 404);

    if (target[0].role === "admin") {
      return ok({ id, role: "admin", permissions: {}, isAdmin: true });
    }

    const rows = await db
      .select({ permKey: userPermissions.permKey })
      .from(userPermissions)
      .where(eq(userPermissions.userId, id));
    const permissions: Record<string, boolean> = {};
    for (const r of rows) permissions[r.permKey] = true;
    return ok({ id, role: target[0].role, permissions, isAdmin: false });
  } catch (e) {
    return errResponse(e);
  }
}

/** حفظ صلاحيات مستخدم — يستبدل المجموعة بالكامل في معاملة واحدة. */
export async function PUT(req: Request, ctx: Ctx) {
  const auth = await requirePermission("users.update");
  if (isErr(auth)) return auth.res;
  const { user } = auth;

  const { id: rawId } = await ctx.params;
  const id = Math.trunc(num(rawId));
  if (!id) return bad("معرّف غير صالح");
  if (id === user.id) return bad("لا يمكنك تعديل صلاحيات حسابك أنت");

  const body = await readBody<Record<string, unknown>>(req);
  if (!body) return bad("طلب غير صالح");
  const input = body.permissions ?? body;

  try {
    await ensureSchema();
    const target = await db
      .select({ id: users.id, name: users.name, username: users.username, role: users.role })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (!target[0]) return bad("المستخدم غير موجود", 404);
    if (target[0].role === "admin")
      return bad("حساب المدير يملك كل الصلاحيات ولا يمكن تقييده", 409);

    const { granted, removed } = await replaceUserPermissions(id, input);

    await logActivity(db, {
      userId: user.id,
      userName: user.name,
      action: "تعديل صلاحيات",
      entity: "مستخدم",
      entityId: id,
      details: `ضبط صلاحيات "${target[0].username}" — ممنوح: ${granted.length}${
        removed.length ? `، مسحوب: ${removed.length}` : ""
      }`,
    });

    const permissions: Record<string, boolean> = {};
    for (const k of granted) permissions[k as PermissionKey] = true;
    return ok({ id, permissions, granted, removed });
  } catch (e) {
    return errResponse(e);
  }
}
