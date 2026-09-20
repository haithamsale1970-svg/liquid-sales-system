import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSession,
} from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { bad, logActivity, ok, readBody } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!rateLimit(`login:${ip}`, 10, 5 * 60_000)) {
    return bad("محاولات دخول كثيرة جدًا، حاول مرة أخرى بعد 5 دقائق", 429);
  }
  const body = await readBody<{ username?: string; password?: string }>(req);
  const username = (body?.username ?? "").trim();
  const password = body?.password ?? "";
  if (!username || !password) {
    return bad("أدخل اسم المستخدم وكلمة المرور");
  }
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  const user = rows[0];
  const valid = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !valid) {
    return bad("اسم المستخدم أو كلمة المرور غير صحيحة", 401);
  }
  const { token } = await createSession(user.id);
  await logActivity(db, {
    userId: user.id,
    userName: user.name,
    action: "تسجيل دخول",
    entity: "دخول",
    entityId: user.id,
    details: `قام ${user.name} بتسجيل الدخول`,
  });
  const res = ok(
    { id: user.id, username: user.username, name: user.name, role: user.role },
    { status: 200 },
  );
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return res;
}
