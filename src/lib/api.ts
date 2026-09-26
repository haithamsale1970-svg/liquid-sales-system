import { NextResponse } from "next/server";
import { db } from "@/db";
import { describeDbError } from "@/db/connection";
import { activityLogs } from "@/db/schema";
import { getSessionUser, type SessionUser } from "./auth";
import { can, permissionLabel, type PermissionKey } from "./permissions";

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type DbOrTx = typeof db | Tx;

// Business-logic error with a safe, user-facing message (thrown inside
// transactions and translated into a 400/409 response).
export class BizError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function errResponse(e: unknown) {
  if (e instanceof BizError) return bad(e.message, e.status);
  console.error(e);
  // نترجم أخطاء قاعدة البيانات إلى رسالة عربية واضحة بدل الرسالة العامة.
  return bad(describeDbError(e), 500);
}

export function ok(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

type AuthResult = { user: SessionUser } | { res: NextResponse };

export async function requireUser(): Promise<AuthResult> {
  const user = await getSessionUser();
  if (!user) return { res: bad("يجب تسجيل الدخول أولاً", 401) };
  return { user };
}

export async function requireAdmin(): Promise<AuthResult> {
  const user = await getSessionUser();
  if (!user) return { res: bad("يجب تسجيل الدخول أولاً", 401) };
  if (user.role !== "admin")
    return { res: bad("هذه العملية تتطلب صلاحية المدير (ماستر)", 403) };
  return { user };
}

/**
 * يطلب صلاحية محدّدة بدل "المدير فقط".
 * المدير يتجاوز كل الصلاحيات، وغير المدير يُمنع إن لم تكن الصلاحية ممنوحة له.
 */
export async function requirePermission(
  key: PermissionKey,
): Promise<AuthResult> {
  const user = await getSessionUser();
  if (!user) return { res: bad("يجب تسجيل الدخول أولاً", 401) };
  if (!can(user, key))
    return {
      res: bad(`ليست لديك صلاحية: ${permissionLabel(key)}`, 403),
    };
  return { user };
}

export function isErr(
  auth: AuthResult,
): auth is { res: NextResponse } {
  return "res" in auth;
}

export type LogInput = {
  userId: number | null;
  userName: string;
  action: string;
  entity: "منتج" | "عميل" | "فاتورة" | "مستخدم" | "نظام" | "دخول" | "ديون" | "مصروف" | "مرتجع" | "مخزون";
  entityId?: number | null;
  details?: string;
};

export async function logActivity(conn: DbOrTx, entry: LogInput) {
  await conn.insert(activityLogs).values({
    userId: entry.userId,
    userName: entry.userName,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId ?? null,
    details: entry.details ?? "",
  });
}

export function num(v: unknown): number {
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function clampInt(v: unknown, min: number, max: number): number {
  const n = Math.trunc(num(v));
  return Math.min(max, Math.max(min, n));
}

export async function readBody<T = Record<string, unknown>>(
  req: Request,
): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}
