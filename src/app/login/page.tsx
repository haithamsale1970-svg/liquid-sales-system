"use client";

import { useState, type FormEvent } from "react";
import {
  Droplets,
  Eye,
  EyeOff,
  Lock,
  LogIn,
  Package,
  ReceiptText,
  ShieldCheck,
  User,
} from "lucide-react";
import { Spinner } from "@/components/ui";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
    <main className="relative min-h-screen overflow-hidden">
      {/* background */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/login-art.jpg"
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-55"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#050505]/70 via-[#050505]/55 to-[#050505]" />
      <div
        className="absolute -top-24 start-[-120px] h-[420px] w-[420px] rounded-full opacity-25 blur-3xl"
        style={{ background: "radial-gradient(circle,#ff2222,transparent 65%)", animation: "floaty 9s ease-in-out infinite" }}
      />
      <div
        className="absolute bottom-[-140px] end-[-100px] h-[480px] w-[480px] rounded-full opacity-20 blur-3xl"
        style={{ background: "radial-gradient(circle,#7a0000,transparent 65%)", animation: "floaty 11s ease-in-out infinite reverse" }}
      />

      <div className="relative z-10 mx-auto grid min-h-screen max-w-[1240px] lg:grid-cols-2">
        {/* brand side */}
        <div className="hidden flex-col justify-between p-12 lg:flex">
          <div className="anim-in flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl"
              style={{
                background: "linear-gradient(135deg,#ff2b2b 0%,#8f0000 60%,#000000 100%)",
                boxShadow: "0 14px 34px -10px rgba(255,34,34,.6)",
              }}
            >
              <Droplets size={24} className="text-white" strokeWidth={2.7} />
            </div>
            <div className="leading-tight">
              <div className="text-2xl font-black tracking-tight">Cloud Culture</div>
              <div className="text-[11px] font-bold text-[var(--muted)]">
                CLOUD CULTURE • SALES SUITE
              </div>
            </div>
          </div>

          <div>
            <h1 className="anim-in anim-d1 max-w-[520px] text-[44px] font-black leading-[1.25] tracking-tight">
              كل قطرة…
              <br />
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: "linear-gradient(90deg,#ff2b2b,#ff7a7a,#ffffff)" }}
              >
                تحت السيطرة الكاملة
              </span>
            </h1>
            <p className="anim-in anim-d2 mt-5 max-w-[440px] text-[15px] font-semibold leading-8 text-[var(--muted)]">
              نظام Cloud Culture المتكامل لإدارة المنتجات: أصناف
              ومخزون لحظي، فواتير احترافية بصور المنتجات، عملاء، صلاحيات،
              تقارير مبيعات، ونسخ احتياطي — كل حركة مسجلة باسم من قام بها.
            </p>
            <div className="anim-in anim-d3 mt-8 flex flex-wrap gap-2.5">
              {[
                { icon: Package, t: "مخزون يُحدَّث تلقائيًا" },
                { icon: ReceiptText, t: "فواتير قابلة للطباعة و PDF" },
                { icon: ShieldCheck, t: "صلاحيات وتشفير كلمات المرور" },
              ].map((c) => (
                <span
                  key={c.t}
                  className="badge badge-slate !px-3.5 !py-2 !text-[12px]"
                  style={{ background: "rgba(5,5,5,.55)", backdropFilter: "blur(8px)" }}
                >
                  <c.icon size={14} className="text-[var(--mint)]" />
                  {c.t}
                </span>
              ))}
            </div>
          </div>

          <div className="anim-in anim-d4 text-[11.5px] font-bold text-[var(--faint)]">
            نظام Cloud Culture v1.0 — إدارة ذكية لنشاطك التجاري
          </div>
        </div>

        {/* form side */}
        <div className="flex items-center justify-center p-5 sm:p-10">
          <div
            className="anim-in w-full max-w-[430px] rounded-3xl border border-[var(--line)] p-7 sm:p-9"
            style={{
              background: "rgba(5,5,5,.72)",
              backdropFilter: "blur(20px)",
              boxShadow: "0 40px 90px -30px rgba(0,0,0,.8)",
            }}
          >
            <div className="mb-7 flex items-center gap-3 lg:hidden">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-2xl"
                style={{ background: "linear-gradient(135deg,#ff2b2b,#8f0000)" }}
              >
                <Droplets size={22} className="text-white" strokeWidth={2.7} />
              </div>
              <div className="text-xl font-black">Cloud Culture</div>
            </div>

            <h2 className="text-[22px] font-black">تسجيل الدخول</h2>
            <p className="mt-1.5 text-[13px] font-semibold text-[var(--muted)]">
              مرحبًا بعودتك — أدخل بيانات حسابك للمتابعة
            </p>

            <form onSubmit={submit} className="mt-7 space-y-4">
              <div>
                <label className="lbl">اسم المستخدم</label>
                <div className="relative">
                  <input
                    className="inp pe-11"
                    placeholder="admin"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    autoFocus
                    dir="ltr"
                    style={{ textAlign: "left" }}
                  />
                  <User
                    size={17}
                    className="pointer-events-none absolute end-3.5 top-1/2 -translate-y-1/2 text-[var(--faint)]"
                  />
                </div>
              </div>
              <div>
                <label className="lbl">كلمة المرور</label>
                <div className="relative">
                  <input
                    className="inp pe-11 ps-11"
                    placeholder="••••••••"
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    dir="ltr"
                    style={{ textAlign: "left" }}
                  />
                  <Lock
                    size={17}
                    className="pointer-events-none absolute end-3.5 top-1/2 -translate-y-1/2 text-[var(--faint)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((s) => !s)}
                    className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--faint)] transition-colors hover:text-[var(--text)]"
                    aria-label="إظهار كلمة المرور"
                  >
                    {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="badge badge-rose w-full !justify-center !py-2.5 !text-[12.5px]">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !username || !password}
                className="btn btn-primary w-full !py-3 !text-[14.5px]"
              >
                {loading ? <Spinner size={16} /> : <LogIn size={16} />}
                دخول إلى لوحة التحكم
              </button>
            </form>

            <div className="hr" />
            <p className="text-center text-[11.5px] font-bold leading-6 text-[var(--faint)]">
              محاولات الدخول محدودة ومحمية — جميع كلمات المرور مشفّرة
              <br />
              الحساب الافتراضي: <span className="num text-[var(--muted)]">admin / admin123</span> (غيّره فورًا)
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
