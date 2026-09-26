"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Banknote,
  BarChart3,
  Droplets,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PackageSearch,
  PlusCircle,
  ScrollText,
  Settings,
  ShoppingCart,
  Undo2,
  Users,
  UsersRound,
  Wallet,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { ToastProvider } from "./toast";
import CurrencySwitcher from "./CurrencySwitcher";
import LowStockBanner from "./LowStockBanner";
import NoAccess from "./NoAccess";
import { cls, initials, type SessionUserDTO } from "@/lib/shared";
import { api } from "@/lib/client";
import { can, hasAnyPermission, type PermissionKey } from "@/lib/permissions";
import type { AppSettings } from "@/lib/currency";

/** صلاحية الدخول لكل عنصر في القائمة الجانبية. */
const NAV = [
  { href: "/", label: "لوحة التحكم", icon: LayoutDashboard, perm: "dashboard.view" },
  { href: "/products", label: "الأصناف والمخزون", icon: Package, perm: "products.view", settingsKey: "products" },
  { href: "/sales", label: "الفواتير", icon: ShoppingCart, perm: "sales.view" },
  { href: "/sales/new", label: "فاتورة جديدة", icon: PlusCircle, perm: "sales.create", accent: true },
  { href: "/clients", label: "العملاء", icon: Users, perm: "clients.view", settingsKey: "clients" },
  { href: "/debts", label: "الديون والتحصيل", icon: Wallet, perm: "debts.view" },
  { href: "/expenses", label: "المصاريف", icon: Banknote, perm: "expenses.view" },
  { href: "/inventory", label: "حركة المخزون", icon: PackageSearch, perm: "inventory.view" },
  { href: "/returns", label: "المرتجعات والاستبدال", icon: Undo2, perm: "returns.view" },
  { href: "/reports", label: "التقارير", icon: BarChart3, perm: "reports.view", settingsKey: "reports" },
  { href: "/users", label: "المستخدمون", icon: UsersRound, perm: "users.view" },
  { href: "/activity", label: "سجل النشاط", icon: ScrollText, perm: "activity.view" },
  { href: "/settings", label: "الإعدادات والنسخ", icon: Settings, perm: "settings.view" },
] as const satisfies readonly {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  perm: PermissionKey;
  settingsKey?: "products" | "clients" | "reports";
  accent?: boolean;
}[];

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
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  // على الجوال: منع تمرير الصفحة خلف القائمة المفتوحة + الإغلاق بمفتاح Escape.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  useEffect(() => {
    api<AppSettings>("/api/settings").then(setSettings).catch(() => {});
  }, []);

  const active = bestMatch(pathname);
  const title = pageTitle(pathname);
  const isAdmin = user.role === "admin";

  // الأدمن يتحكم بإظهار/إخفاء الأقسام عن باقي المستخدمين من الإعدادات،
  // ويملك كذلك تحكمًا دقيقًا بصلاحيات كل مستخدم.
  const visibleNav = NAV.filter((n) => {
    // 1) صلاحية الدخول: أهم شرط — يخفي القسم كليًا لمن لا يملكها.
    if (!can(user, n.perm)) return false;
    // 2) مفتاح إعدادات قديم يربط القسم بإعدادات "إظهار الأقسام".
    if (!isAdmin && settings && "settingsKey" in n && n.settingsKey) {
      if (n.settingsKey === "reports" && !settings.showReportsForUsers) return false;
      if (n.settingsKey === "clients" && !settings.showClientsForUsers) return false;
      if (n.settingsKey === "products" && !settings.showProductsForUsers) return false;
    }
    return true;
  });

  // الصفحة الحالية ممنوعة إن لم يملك المستخدم صلاحية قسمها.
  // ملاحظة: "/" صفحة هبوط آمنة — لا تُعامل كصفحة محجوبة أبدًا لتفادي
  // حلقة إعادة توجيه لا نهائية عندما لا يملك المستخدم أي صلاحية.
  const currentPerm = NAV.find(
    (n) => n.href !== "/" && (pathname === n.href || pathname.startsWith(`${n.href}/`)),
  )?.perm;
  const isForbiddenPath = !!currentPerm && !can(user, currentPerm);

  // لا يملك أي صلاحية إطلاقًا (حالة شائعة: مستخدم جديد قبل ضبط صلاحياته).
  const hasNothing = !hasAnyPermission(user);

  // أول صفحة يملكها المستخدم — تُستخدم كوجهة بديلة بدل الشاشة السوداء.
  const fallbackHref = visibleNav[0]?.href ?? null;

  useEffect(() => {
    if (!isForbiddenPath || hasNothing || !fallbackHref) return;
    if (fallbackHref !== pathname) router.replace(fallbackHref);
  }, [isForbiddenPath, hasNothing, fallbackHref, pathname, router]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/login";
  }

  // حاجز أمان مطلق: لا نعيد null أبدًا (كان مصدر الشاشة السوداء).
  // نعرض بدلًا منه رسالة واضحة، أو المحتوى إن كان مسموحًا.
  const guard =
    hasNothing || isForbiddenPath ? (
      <NoAccess
        kind={hasNothing ? "no-permissions" : "forbidden"}
        section={NAV.find((n) => n.perm === currentPerm)?.label}
        retryHref={hasNothing ? undefined : (fallbackHref ?? undefined)}
      />
    ) : (
      children
    );

  return (
    <ToastProvider>
      <div className="flex min-h-screen overflow-x-hidden">
        {/* ===== sidebar ===== */}
        <aside
          data-sidebar
          data-chrome
          className={cls(
            "flex w-[252px] max-w-[84vw] shrink-0 flex-col gap-1.5 border-e border-[var(--line-soft)] bg-[#050505]/95 p-4 backdrop-blur-xl lg:sticky lg:top-0 lg:h-screen",
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
            {visibleNav.map((n) => {
              const Icon = n.icon;
              const isActive = active === n.href;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  onClick={() => setOpen(false)}
                  aria-current={isActive ? "page" : undefined}
                  className={cls("navlink", isActive && "active")}
                >
                  <Icon size={17} strokeWidth={2.3} />
                  <span>{n.label}</span>
                </Link>
              );
            })}
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
            className="sticky top-0 z-40 flex min-w-0 items-center justify-between gap-2 border-b border-[var(--line-soft)] bg-[#050505]/90 px-3 py-2.5 backdrop-blur-xl sm:gap-3 sm:px-6 sm:py-3"
          >
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
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
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
              <CurrencySwitcher defaultCurrency={settings?.defaultCurrency} compact />
              <span className="badge badge-slate hidden md:inline-flex">
                {new Date().toLocaleDateString("ar-EG-u-nu-latn", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </span>
              {can(user, "sales.create") && (
                <Link href="/sales/new" className="btn btn-primary btn-sm">
                  <PlusCircle size={15} />
                  <span className="hidden sm:inline">فاتورة جديدة</span>
                </Link>
              )}
            </div>
          </header>
          <main
            data-main
            className="mx-auto w-full max-w-[1240px] flex-1 px-3 py-4 sm:px-6 sm:py-6"
          >
            {can(user, "products.view") && <LowStockBanner />}
            {guard}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
