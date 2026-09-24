import { bad, errResponse, isErr, logActivity, num, ok, readBody, requireAdmin } from "@/lib/api";
import { db } from "@/db";
import { expenses } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// حذف مصروف (الأدمن فقط).
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (isErr(auth)) return auth.res;
  const { user } = auth;
  const { id: rawId } = await ctx.params;
  const id = Math.trunc(num(rawId));
  if (!id) return bad("معرّف غير صالح");

  try {
    const rows = await db
      .delete(expenses)
      .where(eq(expenses.id, id))
      .returning();
    if (!rows[0]) return bad("المصروف غير موجود", 404);
    await logActivity(db, {
      userId: user.id,
      userName: user.name,
      action: "حذف مصروف",
      entity: "مصروف",
      entityId: id,
      details: `حذف مصروف ${num(rows[0].amount)} (${rows[0].category || "أخرى"})`,
    });
    return ok({ ok: true });
  } catch (e) {
    return errResponse(e);
  }
}