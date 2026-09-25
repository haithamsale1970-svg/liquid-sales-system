import { getSessionUser } from "@/lib/auth";
import { bad, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return bad("غير مسجل الدخول", 401);
  return ok(user);
}
