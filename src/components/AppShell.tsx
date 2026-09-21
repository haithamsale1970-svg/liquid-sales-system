"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Droplets,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PlusCircle,
  ScrollText,
  Settings,
  ShoppingCart,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { ToastProvider } from "./toast";
import { cls, initials, type SessionUserDTO } from "@/lib/shared";

const NAV = [
  { href: "/", label: "لوحة التحكم", icon: LayoutDashboard },
  { href: "/products", label: "الأصناف والمخزون", icon: Package },
  { href: "/sales", label: "الفواتير", icon: ShoppingCart },
  { href: "/sales/new", label: "فاتورة جديدة", icon: PlusCircle, accent: true },
  { href: "/clients", label: "العملاء", icon: Users },
  { href: "/reports", label: "التقارير", icon: BarChart3 },
  { href: "/users", label: "المستخدمون", icon: UsersRound, admin: true },
  { href: "/activity", label: "سجل النشاط", icon: ScrollText, admin: true },
  { href: "/settings", label: "الإعدادات والنسخ", icon: Settings },
] as const;

function bestMatch(pathname: string): string {
  if (pathname === "/") return "/";
  let best = "";
  for (const n of NAV) {
    if (n.href !== "/" && pathname.startsWith(n.href) && n.href.length > best.length) {
      best = n.href;
    }
  }
  return best;
}

function pageTitle(pathname: string): string {
  if (pathname === "/") return "لوحة التحكم";
  if (/^\/sales\/\d+/.test(pathname)) return "تفاصيل الفاتورة";
  const m = bestMatch(pathname);
  return NAV.find((n) => n.href === m)?.label ?? "Cloud Culture";
}

export default function AppShell({
  user,
  children,
}: {
  user: SessionUserDTO;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const active = bestMatch(pathname);
  const title = pageTitle(pathname);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/login";
  }

  return (
    <ToastProvider>
      <div className="flex min-h-screen">
        {/* ===== sidebar ===== */}
        <aside
          data-sidebar
          className={cls(
            "flex w-[252px] shrink-0 flex-col gap-1.5 border-e border-[var(--line-soft)] bg-[#050505]/95 p-4 backdrop-blur-xl lg:sticky lg:top-0 lg:h-screen",
            open && "open",
          )}
        >
          <div className="mb-2 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 px-1 py-2">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
                style={{
                  background: "linear-gradient(135deg,#ff2b2b 0%,#8f0000 60%,#000000 100%)",
                  boxShadow: "0 10px 26px -8px rgba(255,34,34,.5)",
                }}
              >
                <Droplets size={20} className="text-white" strokeWidth={2.7} />
              </div>
              <div className="leading-tight">
                <div className="text-[18px] font-black tracking-tight">Cloud Culture</div>
                <div className="text-[10.5px] font-bold text-[var(--faint)]">
                  إدارة المنتجات والمبيعات
                </div>
              </div>
            </Link>
            <button
              className="icon-btn lg:hidden"
              onClick={() => setOpen(false)}
              aria-label="إغلاق القائمة"
            >
              <X size={16} />
            </button>
          </div>

          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
            {NAV.filter((n) => !("admin" in n && n.admin) || user.role === "admin").map(
              (n) => {
                const Icon = n.icon;
                const isActive = active === n.href;
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    className={cls("navlink", isActive && "active")}
                  >
                    <Icon size={17} strokeWidth={2.3} />
                    <span>{n.label}</span>
                  </Link>
                );
              },
            )}
          </nav>

          <div className="mt-2 rounded-2xl border border-[var(--line-soft)] bg-[rgba(255,255,255,.03)] p-3.5">
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[12px] font-extrabold text-white"
                style={{ background: "linear-gradient(135deg,#ff2b2b,#8f0000)" }}
              >
                {initials(user.name)}
              </div>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="truncate text-[13px] font-extrabold">{user.name}</div>
                <div className="text-[11px] font-bold text-[var(--faint)]">
                  {user.role === "admin" ? "مدير النظام (ماستر)" : "شريك"}
                </div>
              </div>
              <button
                className="icon-btn danger"
                onClick={logout}
                title="تسجيل الخروج"
                aria-label="تسجيل الخروج"
              >
                <LogOut size={15} />
              </button>
            </div>
          </div>
        </aside>

        {open && (
          <div
            className="fixed inset-0 z-[65] bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setOpen(false)}
          />
        )}

        {/* ===== main ===== */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header
            data-chrome
            className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-[var(--line-soft)] bg-[#050505]/85 px-4 py-3 backdrop-blur-xl sm:px-6"
          >
            <div className="flex min-w-0 items-center gap-3">
              <button
                className="icon-btn lg:hidden"
                onClick={() => setOpen(true)}
                aria-label="فتح القائمة"
              >
                <Menu size={17} />
              </button>
              <h1 className="truncate text-[15.5px] font-extrabold sm:text-[17px]">
                {title}
              </h1>
              <div className="glow-dot hidden sm:block" />
            </div>
            <div className="flex items-center gap-2.5">
              <span className="badge badge-slate hidden md:inline-flex">
                {new Date().toLocaleDateString("ar-EG-u-nu-latn", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </span>
              <Link href="/sales/new" className="btn btn-primary btn-sm">
                <PlusCircle size={15} />
                <span className="hidden sm:inline">فاتورة جديدة</span>
              </Link>
            </div>
          </header>
          <main
            data-main
            className="mx-auto w-full max-w-[1240px] flex-1 px-4 py-6 sm:px-6"
          >
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
