import { getSessionUser } from "@/lib/auth";
import { getAppSettings } from "@/lib/settings";
import { bad, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return bad("غير مسجل الدخول", 401);
  const settings = await getAppSettings();
  return ok({
    ...user,
    canEditClients:
      user.role === "admin" ||
      (user.canEditClients && settings.allowUsersEditClients),
  });
}
