import { and, eq, ne, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { sales, sessions, users } from "@/db/schema";
import {
  BizError,
  bad,
  errResponse,
  isErr,
  logActivity,
  num,
  ok,
  readBody,
  requireUser,
} from "@/lib/api";
import { SESSION_COOKIE } from "@/lib/auth";
import { hashPassword } from "@/lib/password";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function otherAdminsCount(excludeId: number): Promise<number> {
  const rows = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(users)
    .where(and(eq(users.role, "admin"), ne(users.id, excludeId)));
  return rows[0]?.c ?? 0;
}

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireUser();
  if (isErr(auth)) return auth.res;
  const { user } = auth;
  const { id: rawId } = await ctx.params;
  const id = Math.trunc(num(rawId));
  if (!id) return bad("معرّف غير صالح");

  const targetRows = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  const target = targetRows[0];
  if (!target) return bad("المستخدم غير موجود", 404);

  const isSelf = target.id === user.id;
  if (!isSelf && user.role !== "admin")
    return bad("يمكنك تعديل حسابك فقط", 403);

  const body = await readBody<Record<string, unknown>>(req);
  if (!body) return bad("طلب غير صالح");

  const updates: Partial<typeof users.$inferInsert> = {};
  const changes: string[] = [];

  if (typeof body.name === "string" && body.name.trim().length >= 2) {
    updates.name = body.name.trim().slice(0, 80);
    changes.push("الاسم");
  }

  if (typeof body.password === "string" && body.password.length) {
    if (body.password.length < 6)
      return bad("كلمة المرور 6 أحرف على الأقل");
    updates.passwordHash = await hashPassword(body.password);
    changes.push("كلمة المرور");
  }

  if (typeof body.role === "string") {
    if (user.role !== "admin") return bad("تغيير الصلاحية للمدير فقط", 403);
    if (isSelf) return bad("لا يمكنك تغيير صلاحيتك بنفسك");
    const role = body.role === "admin" ? "admin" : "user";
    if (target.role === "admin" && role === "user") {
      const others = await otherAdminsCount(target.id);
      if (others === 0)
        return bad("لا يمكن إزالة صلاحية آخر مدير في النظام", 409);
    }
    if (role !== target.role) {
      updates.role = role;
      changes.push("الصلاحية");
    }
  }

  if (typeof body.canEditClients === "boolean") {
    if (user.role !== "admin")
      return bad("تغيير صلاحية تعديل العملاء للمدير فقط", 403);
    if (isSelf) return bad("لا يمكنك تغيير صلاحيتك بنفسك");
    const canEditClients = body.canEditClients;
    if (canEditClients !== target.canEditClients) {
      updates.canEditClients = canEditClients;
      changes.push("صلاحية تعديل العملاء");
    }
  }

  if (!Object.keys(updates).length) return bad("لا يوجد تعديل");

  // self-service password change requires the current password
  if (updates.passwordHash && isSelf) {
    const current = String(body.currentPassword ?? "");
    const { verifyPassword } = await import("@/lib/password");
    const okPw = await verifyPassword(current, target.passwordHash);
    if (!okPw) return bad("كلمة المرور الحالية غير صحيحة");
  }

  try {
    await db.update(users).set(updates).where(eq(users.id, id));

    if (updates.passwordHash) {
      // revoke other sessions of the target, keep the caller's own session
      const store = await cookies();
      const current = store.get(SESSION_COOKIE)?.value;
      if (isSelf && current) {
        await db
          .delete(sessions)
          .where(and(eq(sessions.userId, id), ne(sessions.id, current)));
      } else {
        await db.delete(sessions).where(eq(sessions.userId, id));
      }
    }

    await logActivity(db, {
      userId: user.id,
      userName: user.name,
      action: "تعديل مستخدم",
      entity: "مستخدم",
      entityId: id,
      details: `تعديل (${changes.join("، ")}) للمستخدم "${target.username}"`,
    });
    return ok({ ok: true });
  } catch (e) {
    return errResponse(e);
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = await requireUser();
  if (isErr(auth)) return auth.res;
  const { user } = auth;
  if (user.role !== "admin") return bad("حذف المستخدمين للمدير فقط", 403);
  const { id: rawId } = await ctx.params;
  const id = Math.trunc(num(rawId));
  if (!id) return bad("معرّف غير صالح");
  if (id === user.id) return bad("لا يمكنك حذف حسابك بنفسك");

  const targetRows = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  const target = targetRows[0];
  if (!target) return bad("المستخدم غير موجود", 404);

  try {
    if (target.role === "admin") {
      const others = await otherAdminsCount(target.id);
      if (others === 0)
        throw new BizError("لا يمكن حذف آخر مدير في النظام", 409);
    }
    const salesCount = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(sales)
      .where(eq(sales.userId, id));
    if ((salesCount[0]?.c ?? 0) > 0)
      throw new BizError(
        "لا يمكن حذف مستخدم له فواتير مسجلة — غيّر صلاحيته أو أعطِه كلمة مرور عشوائية بدلًا من ذلك",
        409,
      );

    await db.delete(sessions).where(eq(sessions.userId, id));
    await db.delete(users).where(eq(users.id, id));

    await logActivity(db, {
      userId: user.id,
      userName: user.name,
      action: "حذف مستخدم",
      entity: "مستخدم",
      entityId: id,
      details: `حذف حساب "${target.username}" (${target.name})`,
    });
    return ok({ ok: true });
  } catch (e) {
    return errResponse(e);
  }
}
