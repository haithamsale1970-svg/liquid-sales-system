import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  bad,
  errResponse,
  isErr,
  logActivity,
  ok,
  readBody,
  requireAdmin,
} from "@/lib/api";
import { hashPassword } from "@/lib/password";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdmin();
  if (isErr(auth)) return auth.res;
  try {
    const rows = await db
      .select({
        id: users.id,
        username: users.username,
        name: users.name,
        role: users.role,
        createdAt: users.createdAt,
        salesCount: sql<number>`coalesce((select count(*)::int from sales s where s.user_id = ${users.id}), 0)`,
      })
      .from(users)
      .orderBy(asc(users.id));
    return ok(
      rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    );
  } catch (e) {
    return errResponse(e);
  }
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (isErr(auth)) return auth.res;
  const { user } = auth;

  const body = await readBody<Record<string, unknown>>(req);
  if (!body) return bad("طلب غير صالح");
  const username = String(body.username ?? "").trim().toLowerCase();
  const name = String(body.name ?? "").trim();
  const password = String(body.password ?? "");
  const role = body.role === "admin" ? "admin" : "user";
  if (!/^[a-z0-9_.-]{3,30}$/.test(username))
    return bad("اسم المستخدم: 3-30 حرفًا إنجليزيًا أو أرقامًا بدون مسافات");
  if (name.length < 2) return bad("الاسم المعروض مطلوب");
  if (password.length < 6) return bad("كلمة المرور 6 أحرف على الأقل");

  try {
    const exists = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    if (exists[0]) return bad("اسم المستخدم مستخدم بالفعل", 409);

    const passwordHash = await hashPassword(password);
    const rows = await db
      .insert(users)
      .values({ username, name: name.slice(0, 80), passwordHash, role })
      .returning({ id: users.id });

    await logActivity(db, {
      userId: user.id,
      userName: user.name,
      action: "إنشاء مستخدم",
      entity: "مستخدم",
      entityId: rows[0].id,
      details: `إنشاء حساب "${username}" (${
        role === "admin" ? "مدير" : "مستخدم"
      }) باسم ${name}`,
    });
    return ok({ id: rows[0].id }, { status: 201 });
  } catch (e) {
    return errResponse(e);
  }
}
