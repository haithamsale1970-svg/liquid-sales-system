"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Eye, EyeOff, Lock, LogIn, Sparkles, User } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import ThemeToggle from "@/components/ThemeToggle";
import { Spinner } from "@/components/ui";

/** سجل يثبت أن المستخدم شاهد شاشة الترحيب، فلا تُعرض مرة أخرى في هذه الجلسة. */
const WELCOMED_KEY = "cc_welcomed";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // شاشة الترحيب تظهر أول مرة فقط (مرتبطة بجلسة المتصفح).
  const [stage, setStage] = useState<"welcome" | "form">("form");
  const [leaving, setLeaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let welcomed = "0";
    try {
      welcomed = sessionStorage.getItem(WELCOMED_KEY) ?? "0";
    } catch {}
    setStage(welcomed === "1" ? "form" : "welcome");
    setMounted(true);
  }, []);

  /** انتقال سلس: تلاشٍ خارج ثم تبديل المحتوى. */
  function goToForm() {
    if (leaving) return;
    setLeaving(true);
    try {
      sessionStorage.setItem(WELCOMED_KEY, "1");
    } catch {}
    window.setTimeout(() => {
      setStage("form");
      setLeaving(false);
    }, 320);
  }

  /** زر الرجوع لشاشة الترحيب. */
  function goToWelcome() {
    if (leaving) return;
    setLeaving(true);
    window.setTimeout(() => {
      setStage("welcome");
      setLeaving(false);
    }, 320);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "تعذر تسجيل الدخول");
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تسجيل الدخول");
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-10">
      {/* خلفية هادئة ونظيفة: تتبع الثيم (توهّج داكن أو فسفوري فاتح) */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(900px 520px at 50% -8%, var(--glow-1), transparent 62%)," +
            "radial-gradient(700px 480px at 50% 112%, var(--glow-2), transparent 65%)," +
            "var(--bg)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[.55]"
        style={{
          backgroundImage:
            "linear-gradient(var(--line-soft) 1px, transparent 1px)," +
            "linear-gradient(90deg, var(--line-soft) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage:
            "radial-gradient(circle at 50% 42%, black 0%, transparent 72%)",
          WebkitMaskImage:
            "radial-gradient(circle at 50% 42%, black 0%, transparent 72%)",
        }}
      />

      {/* زر تبديل الثيم في صفحة الدخول أيضًا */}
      <div className="absolute end-5 top-5 z-20">
        <ThemeToggle />
      </div>

      <div
        className="relative z-10 flex w-full max-w-[420px] flex-col items-center"
        // انتقال ناعم بين الشاشتين (تلاشٍ + صعود خفيف)
        style={{
          opacity: leaving ? 0 : 1,
          transform: leaving ? "translateY(-10px) scale(.98)" : "translateY(0) scale(1)",
          transition: "opacity .32s ease, transform .32s cubic-bezier(.2,.8,.3,1)",
        }}
      >
        {/* إطار الشعار — مربوط بنظام الثيم */}
        <div className="mb-7 flex flex-col items-center text-center">
          <div
            className="relative rounded-[26px] p-[1.5px]"
            style={{
              background:
                "linear-gradient(160deg, var(--brand-1), var(--brand-2) 45%, var(--brand-3))",
              boxShadow: "0 28px 70px -26px var(--accent-glow)",
            }}
          >
            <div
              className="rounded-[25px]"
              style={{ boxShadow: "inset 0 0 40px -14px var(--brand-3)" }}
            >
              <BrandMark size={92} />
            </div>
          </div>
          <h1 className="mt-5 text-[30px] font-black leading-none tracking-tight sm:text-[34px]">
            Cloud Culture
          </h1>
          <div className="mt-3.5 flex items-center gap-2">
            <span className="h-px w-10 bg-gradient-to-l from-transparent to-[var(--mint)]" />
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--mint)] shadow-[0_0_10px_var(--mint)]" />
            <span className="h-px w-10 bg-gradient-to-r from-transparent to-[var(--mint)]" />
          </div>
        </div>

        {/* ===== شاشة الترحيب (تظهر أول مرة فقط) ===== */}
        {mounted && stage === "welcome" && (
          <div className="w-full text-center">
            <p className="mb-6 text-[14px] font-semibold leading-8 text-[var(--muted)]">
              نظام متكامل لإدارة المبيعات والمخزون
              <br />
              بأصناف وعملاء وفواتير وتقارير وصلاحيات دقيقة.
            </p>

            {/* مزايا النظام — بطاقات مرنة */}
            <ul className="mb-7 grid grid-cols-1 gap-2 text-start sm:grid-cols-3">
              {[
                { t: "إدارة كاملة", d: "أصناف ومخزون" },
                { t: "مبيعات دقيقة", d: "فواتير وتقارير" },
                { t: "صلاحيات صارمة", d: "تحكّم بكل حساب" },
              ].map((f) => (
                <li
                  key={f.t}
                  className="rounded-2xl border border-[var(--line-soft)] bg-[var(--overlay-1)] px-3.5 py-3"
                >
                  <div className="text-[12.5px] font-extrabold">{f.t}</div>
                  <div className="mt-0.5 text-[11.5px] font-semibold text-[var(--faint)]">
                    {f.d}
                  </div>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={goToForm}
              className="btn btn-primary w-full !py-3.5 !text-[14.5px] !rounded-[14px]"
            >
              <Sparkles size={16} />
              ابدأ الآن
            </button>
            <p className="mt-3.5 text-[11.5px] font-semibold text-[var(--faint)]">
              اضغط للمتابعة إلى تسجيل الدخول
            </p>
          </div>
        )}

        {/* نموذج تسجيل الدخول */}
        {(!mounted || stage === "form") && (
          <>
            <div className="auth-card rounded-[26px] p-6 sm:p-8">
              <div className="text-center">
                <h2 className="text-[17px] font-black">تسجيل الدخول</h2>
                <p className="mt-1.5 text-[12.5px] font-semibold text-[var(--faint)]">
                  أدخل بياناتك للمتابعة إلى لوحة التحكم
                </p>
              </div>

              <form onSubmit={submit} className="mt-7 space-y-5">
            {/* اسم المستخدم — التسمية تصف الحقل، فلا حاجة لتكرارها كـ placeholder */}
            <div className="auth-field">
              <label htmlFor="login-user" className="lbl">
                اسم المستخدم
              </label>
              <div className="auth-input-wrap">
                <input
                  id="login-user"
                  className="auth-input"
                  placeholder="مثال: admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoFocus
                  autoCapitalize="none"
                  spellCheck={false}
                  dir="ltr"
                />
                <User size={17} className="auth-icon" aria-hidden />
              </div>
            </div>

            {/* كلمة المرور — زر الإظهار على اليمين والأيقونة على اليسار */}
            <div className="auth-field">
              <label htmlFor="login-pass" className="lbl">
                كلمة المرور
              </label>
              <div className="auth-input-wrap">
                <input
                  id="login-pass"
                  className="auth-input"
                  placeholder="••••••••"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  dir="ltr"
                />
                <Lock size={17} className="auth-icon" aria-hidden />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="auth-toggle"
                  aria-label={showPw ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                  aria-pressed={showPw}
                  title={showPw ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                >
                  {showPw ? (
                    <EyeOff size={17} aria-hidden />
                  ) : (
                    <Eye size={17} aria-hidden />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="alert-chip alert-chip-critical w-full !justify-center !py-2.5 !text-[12.5px]"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !username.trim() || !password}
              className="btn btn-primary w-full !py-3.5 !text-[14.5px] !rounded-[14px]"
            >
              {loading ? <Spinner size={16} /> : <LogIn size={16} />}
              {loading ? "جارٍ الدخول…" : "دخول"}
            </button>
          </form>
            </div>

            {/* زر الرجوع لشاشة الترحيب */}
            <button
              type="button"
              onClick={goToWelcome}
              className="btn btn-ghost mx-auto mt-4 !py-2 !text-[12.5px]"
            >
              <ArrowLeft size={14} />
              رجوع لشاشة الترحيب
            </button>
          </>
        )}
      </div>
    </main>
  );
}
