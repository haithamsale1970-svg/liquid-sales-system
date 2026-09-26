"use client";

import { useEffect } from "react";
import { RefreshCw, ShieldAlert } from "lucide-react";
import { Btn } from "@/components/ui";

/**
 * حاجز أخطاء أخير لكل صفحات لوحة التحكم.
 *
 * وجوده يضمن أن أي استثناء غير متوقع (بيانات ناقصة، خطأ في الصلاحيات،
 * فشل شبكة) يظهر كرسالة مفهومة مع زر إعادة محاولة — بدل الشاشة
 * البيضاء/السوداء أو خطأ Next.js الخام.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-4 text-center">
      <div
        className="kpi-icon"
        style={{
          background: "rgba(255,34,34,.10)",
          border: "1px solid var(--line-soft)",
        }}
      >
        <ShieldAlert size={26} className="text-[var(--muted)]" />
      </div>

      <div className="space-y-2">
        <h2 className="text-[17px] font-black">حدث خطأ غير متوقع</h2>
        <p className="mx-auto max-w-[520px] text-[13px] font-semibold leading-7 text-[var(--muted)]">
          تعذّر عرض هذه الصفحة. غالبًا بسبب بيانات صلاحيات غير مكتملة أو
          مشكلة في الاتصال بقاعدة البيانات. أعد المحاولة، وإذا تكرر الأمر
          راجع مدير النظام.
        </p>
        {error.message && (
          <p className="mx-auto max-w-[520px] break-words rounded-xl border border-[var(--line-soft)] bg-white/[.03] px-3 py-2 text-[11.5px] font-bold text-[var(--faint)]">
            {error.message}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Btn variant="primary" onClick={() => reset()}>
          <RefreshCw size={15} /> إعادة المحاولة
        </Btn>
        <Btn onClick={() => (window.location.href = "/")}>العودة للرئيسية</Btn>
      </div>
    </div>
  );
}
