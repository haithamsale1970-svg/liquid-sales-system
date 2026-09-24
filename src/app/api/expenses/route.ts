import { and, desc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { expenses } from "@/db/schema";
import { bad, errResponse, isErr, logActivity, num, ok, readBody, requireAdmin } from "@/lib/api";

export const dynamic = "force-dynamic";

function dayStart(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// المصاريف التشغيلية (الأدمن فقط).
export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (isErr(auth)) return auth.res;
  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";

  const conds = [];
  if (from) {
    const d = new Date(from);
    if (!isNaN(d.getTime())) conds.push(gte(expenses.createdAt, dayStart(d)));
  }
  if (to) {
    const d = new Date(to);
    if (!isNaN(d.getTime())) {
      const end = dayStart(d);
      end.setDate(end.getDate() + 1);
      conds.push(lt(expenses.createdAt, end));
    }
  }

  try {
    const rows = await db
      .select()
      .from(expenses)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(expenses.createdAt))
      .limit(500);
    return ok(
      rows.map((r) => ({
        id: r.id,
        category: r.category,
        amount: num(r.amount),
        note: r.note,
        userName: r.userName,
        createdAt: r.createdAt.toISOString(),
      })),
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
  const amount = Math.round(num(body.amount) * 1000) / 1000;
  if (!(amount > 0)) return bad("أدخل مبلغ المصروف أكبر من صفر");
  const category = String(body.category ?? "").trim().slice(0, 60);
  const note = String(body.note ?? "").trim().slice(0, 200);

  try {
    const rows = await db
      .insert(expenses)
      .values({
        category: category || "أخرى",
        amount: String(amount),
        note,
        userId: user.id,
        userName: user.name,
      })
      .returning({ id: expenses.id });

    await logActivity(db, {
      userId: user.id,
      userName: user.name,
      action: "إضافة مصروف",
      entity: "مصروف",
      entityId: rows[0].id,
      details: `مصروف ${amount} (${category || "أخرى"})${note ? ` — ${note}` : ""}`,
    });
    return ok({ id: rows[0].id }, { status: 201 });
  } catch (e) {
    return errResponse(e);
  }
}