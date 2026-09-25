import { cookies } from "next/headers";
import { and, eq, gt, lt } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db } from "@/db";
import { ensureSchema } from "@/lib/migrate";
import { sessions, users } from "@/db/schema";

export const SESSION_COOKIE = "sohob_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export type SessionUser = {
  id: number;
  username: string;
  name: string;
  role: "admin" | "user";
};

export async function createSession(userId: number) {
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  await db.insert(sessions).values({ id: token, userId, expiresAt });
  // opportunistic cleanup of expired sessions
  await db
    .delete(sessions)
    .where(lt(sessions.expiresAt, new Date()))
    .catch(() => {});
  return { token, expiresAt };
}

export async function destroySession(token: string) {
  await db.delete(sessions).where(eq(sessions.id, token));
}

export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    // يضمن أن crumb/schema الجديدة موجودة قبل قراءة صلاحية الموظف.
    await ensureSchema();
    const rows = await db
      .select({
        id: users.id,
        username: users.username,
        name: users.name,
        role: users.role,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(and(eq(sessions.id, token), gt(sessions.expiresAt, new Date())))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      username: row.username,
      name: row.name,
      role: row.role,
    };
  } catch {
    return null;
  }
}
