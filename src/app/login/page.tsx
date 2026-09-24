"use client";

import { useState, type FormEvent } from "react";
import { Eye, EyeOff, Lock, LogIn, User } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-10">
      {/* خلفية هادئة ونظيفة: تدرّج أسود عميق مع توهّج أحمر خافت جدًا */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(900px 520px at 50% -8%, rgba(196,0,0,.16), transparent 62%)," +
            "radial-gradient(700px 480px at 50% 112%, rgba(143,0,0,.10), transparent 65%)," +
            "linear-gradient(180deg, #0a0505 0%, #060303 55%, #050202 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[.55]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.022) 1px, transparent 1px)," +
            "linear-gradient(90deg, rgba(255,255,255,.022) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage:
            "radial-gradient(circle at 50% 42%, black 0%, transparent 72%)",
          WebkitMaskImage:
            "radial-gradient(circle at 50% 42%, black 0%, transparent 72%)",
        }}
      />

      <div className="relative z-10 flex w-full max-w-[420px] flex-col items-center">
        {/* الشعار الأحمر الأنيق */}
        <div className="mb-7 flex flex-col items-center text-center">
          <div
            className="relative rounded-[26px] p-[1.5px]"
            style={{
              background:
                "linear-gradient(160deg, rgba(255,77,77,.95), rgba(143,0,0,.55) 45%, rgba(255,77,77,.25))",
              boxShadow:
                "0 28px 70px -26px rgba(196,0,0,.75), inset 0 0 0 1px rgba(255,255,255,.05)",
            }}
          >
            <div
              className="rounded-[25px]"
              style={{ boxShadow: "inset 0 0 40px -14px rgba(0,0,0,.9)" }}
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

        {/* نموذج تسجيل الدخول */}
        <div
          className="w-full rounded-[26px] border border-white/[.07] p-6 sm:p-7"
          style={{
            background:
              "linear-gradient(180deg, rgba(22,8,8,.82) 0%, rgba(10,4,4,.88) 100%)",
            backdropFilter: "blur(18px)",
            boxShadow:
              "0 34px 90px -40px rgba(0,0,0,.95), inset 0 1px 0 rgba(255,255,255,.05)",
          }}
        >
          <h2 className="text-center text-[16.5px] font-black">تسجيل الدخول</h2>
          <p className="mt-1.5 text-center text-[12px] font-semibold text-[var(--faint)]">
            أدخل بياناتك للمتابعة إلى لوحة التحكم
          </p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="lbl">اسم المستخدم</label>
              <div className="relative">
                <input
                  className="inp pe-11"
                  placeholder="اسم المستخدم"
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
              دخول
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
