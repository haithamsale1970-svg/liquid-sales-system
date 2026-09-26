"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, ShieldAlert, ShieldX } from "lucide-react";
import { PERMISSION_GROUPS } from "@/lib/permissions";
import { Btn } from "@/components/ui";

/**
 * شاشة "لا تملك صلاحية" — بديل آمن عن `return null` الذي كان يُنتج شاشة سوداء.
 *
 * تُعرض في حالتين:
 *  1) المستخدم لا يملك أي صلاحية إطلاقًا (لم يمنحه الأدمن شيئًا بعد).
 *  2) المستخدم يحاول فتح صفحة لا يملك صلاحيتها، وقبل أن يتموجيهه لصفحته.
 */
export default function NoAccess({
  kind,
  section,
  retryHref,
  showLogout = true,
}: {
  /** no-permissions = لا يملك شيئًا | forbidden = الصفحة المطلوبة ممنوعة */
  kind: "no-permissions" | "forbidden";
  /** اسم القسم الممنوع (للرسالة) */
  section?: string;
  /** الوجهة البديلة عند وجود صلاحية واحدة على الأقل */
  retryHref?: string;
  showLogout?: boolean;
}) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/login";
  }

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-4 text-center">
      <div
        className="kpi-icon"
        style={{
          background: "rgba(255,34,34,.10)",
          border: "1px solid var(--line-soft)",
        }}
      >
        {kind === "no-permissions" ? (
          <ShieldAlert size={26} className="text-[var(--muted)]" />
        ) : (
          <ShieldX size={26} className="text-[var(--muted)]" />
        )}
      </div>

      <div className="space-y-2">
        <h2 className="text-[17px] font-black">
          {kind === "no-permissions"
            ? "لم يتم منحك أي صلاحية بعد"
            : "لا تملك صلاحية فتح هذه الصفحة"}
        </h2>
        <p className="mx-auto max-w-[520px] text-[13px] font-semibold leading-7 text-[var(--muted)]">
          {kind === "no-permissions"
            ? "حسابك مسجّل ونشط، لكنه لا يملك حتى الآن أي صلاحية من صلاحيات النظام. راجع مدير النظام (الأدمن) ليستطيع فتح الأقسام التي تحتاجها."
            : `قسم «${section ?? "المطلوب"}» غير مُفعّل لحسابك. يمكنك متابعة العمل من إحدى الصفحات المسموحة لك.`}
        </p>
      </div>

      {kind === "no-permissions" && (
        <p className="text-[11.5px] font-bold text-[var(--faint)]">
          الأقسام التي يمكن للأدمن تفعيلها:{" "}
          {PERMISSION_GROUPS.slice(0, 6)
            .map((g) => g.label)
            .join("، ")}
          …
        </p>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2">
        {retryHref && (
          <Btn variant="primary" onClick={() => router.push(retryHref)}>
            الذهاب إلى الصفحة المسموحة
          </Btn>
        )}
        {!retryHref && (
          <Link href="/login" className="btn btn-ghost">
            إعادة تحميل الجلسة
          </Link>
        )}
        {showLogout && (
          <Btn onClick={logout}>
            <LogOut size={15} /> تسجيل الخروج
          </Btn>
        )}
      </div>
    </div>
  );
}
