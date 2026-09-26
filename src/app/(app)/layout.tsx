import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import AppShell from "@/components/AppShell";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  // نمط آمن: أي خطأ في قراءة الجلسة (جدول غير مهيأ، انقطاع شبكة، صلاحية
  // مفقودة) يعيد التوجيه لصفحة الدخول بدل رمي استثناء يُظهر شاشة فارغة.
  let user: Awaited<ReturnType<typeof getSessionUser>> = null;
  try {
    user = await getSessionUser();
  } catch (e) {
    console.error("[app-layout] failed to resolve session:", e);
    user = null;
  }
  if (!user) redirect("/login");
  return <AppShell user={user}>{children}</AppShell>;
}
