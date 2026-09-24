"use client";

import { useEffect, useState } from "react";
import {
  Banknote,
  CalendarClock,
  DatabaseBackup,
  Download,
  Eye,
  EyeOff,
  Info,
  KeyRound,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { api } from "@/lib/client";
import { useToast } from "@/components/toast";
import { Badge, Btn, Card, Field, Input, Select, Skeleton } from "@/components/ui";
import CurrencySwitcher from "@/components/CurrencySwitcher";
import { fmtDateTime, type SessionUserDTO } from "@/lib/shared";
import { CURRENCIES, DEFAULT_SETTINGS, type AppSettings, type CurrencyCode } from "@/lib/currency";

const LAST_BACKUP_KEY = "sohob_last_backup";

function Toggle({
  value,
  onChange,
  label,
  hint,
  onLabel = "ظاهر",
  offLabel = "مخفي",
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint: string;
  onLabel?: string;
  offLabel?: string;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[var(--line-soft)] bg-white/[.02] px-4 py-3 text-start transition-colors hover:bg-white/[.05]"
    >
      <span>
        <span className="block text-[13px] font-extrabold">{label}</span>
        <span className="block text-[11px] font-semibold text-[var(--faint)]">{hint}</span>
      </span>
      <span className="flex items-center gap-1.5 text-[12px] font-black" style={{ color: value ? "var(--mint)" : "var(--faint)" }}>
        {value ? <Eye size={15} /> : <EyeOff size={15} />}
        {value ? onLabel : offLabel}
      </span>
    </button>
  );
}

export default function SettingsPage() {
  const toast = useToast();
  const [me, setMe] = useState<SessionUserDTO | null>(null);
  const [name, setName] = useState("");
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);

  // إعدادات الأدمن (عملات + توصيل + إظهار الأقسام)
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [draft, setDraft] = useState<AppSettings>({ ...DEFAULT_SETTINGS });
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    api<SessionUserDTO>("/api/auth/me")
      .then((u) => {
        setMe(u);
        setName(u.name);
      })
      .catch(() => {});
    setLastBackup(typeof window !== "undefined" ? localStorage.getItem(LAST_BACKUP_KEY) : null);
    api<AppSettings>("/api/settings")
      .then((s) => {
        setSettings(s);
        setDraft(s);
      })
      .catch(() => {});
  }, []);

  async function saveProfile() {
    if (!me || savingProfile) return;
    setSavingProfile(true);
    try {
      await api(`/api/users/${me.id}`, { method: "PATCH", body: { name } });
      toast.push("ok", "تم تحديث الاسم المعروض");
      setMe({ ...me, name });
    } catch (e) {
      toast.push("err", e instanceof Error ? e.message : "تعذر الحفظ");
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword() {
    if (!me || savingPw) return;
    if (next !== confirm) {
      toast.push("info", "تأكيد كلمة المرور غير متطابق");
      return;
    }
    setSavingPw(true);
    try {
      await api(`/api/users/${me.id}`, {
        method: "PATCH",
        body: { password: next, currentPassword: cur },
      });
      toast.push("ok", "تم تغيير كلمة المرور — بقية جلساتك الأخرى أُغلقت");
      setCur("");
      setNext("");
      setConfirm("");
    } catch (e) {
      toast.push("err", e instanceof Error ? e.message : "تعذر التغيير");
    } finally {
      setSavingPw(false);
    }
  }

  function downloadBackup() {
    const stamp = new Date().toISOString();
    localStorage.setItem(LAST_BACKUP_KEY, stamp);
    setLastBackup(stamp);
    window.open("/api/backup", "_blank");
    toast.push("ok", "بدأ تنزيل النسخة الاحتياطية");
  }

  const isAdmin = me?.role === "admin";

  async function saveSettings() {
    if (savingSettings) return;
    setSavingSettings(true);
    try {
      const saved = await api<AppSettings>("/api/settings", { method: "PUT", body: draft });
      setSettings(saved);
      setDraft(saved);
      window.dispatchEvent(new CustomEvent("cc:currency", { detail: undefined }));
      toast.push("ok", "تم حفظ إعدادات العملات والتوصيل والصلاحيات");
    } catch (e) {
      toast.push("err", e instanceof Error ? e.message : "تعذر الحفظ");
    } finally {
      setSavingSettings(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* profile & security */}
      <Card
        className="anim-in self-start"
        title="الملف الشخصي والأمان"
        icon={<ShieldCheck size={16} />}
        bodyClass="space-y-5 p-5"
      >
        {!me ? (
          <div className="space-y-3">
            <Skeleton className="h-11" />
            <Skeleton className="h-11" />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 rounded-2xl border border-[var(--line-soft)] bg-white/[.03] p-4">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-xl text-white"
                style={{ background: "linear-gradient(135deg,#ff2b2b,#8f0000)" }}
              >
                <UserRound size={20} />
              </div>
              <div>
                <div className="text-[14px] font-extrabold">{me.name}</div>
                <div className="text-[11.5px] font-bold text-[var(--faint)]">
                  <span className="num">@{me.username}</span> —{" "}
                  {me.role === "admin" ? "مدير النظام (ماستر)" : "شريك"}
                </div>
              </div>
            </div>

            <Field label="الاسم المعروض">
              <div className="flex gap-2">
                <Input value={name} onChange={(e) => setName(e.target.value)} />
                <Btn variant="primary" size="sm" onClick={saveProfile} loading={savingProfile} disabled={name.trim().length < 2 || name === me.name}>
                  حفظ
                </Btn>
              </div>
            </Field>

            <div>
              <div className="mb-3 flex items-center gap-2 text-[13px] font-extrabold">
                <KeyRound size={15} className="text-[var(--mint)]" />
                تغيير كلمة المرور
              </div>
              <div className="space-y-3">
                <Field label="كلمة المرور الحالية">
                  <Input dir="ltr" type="password" className="num" value={cur} onChange={(e) => setCur(e.target.value)} placeholder="••••••••" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="الجديدة (6 أحرف+)">
                    <Input dir="ltr" type="password" className="num" value={next} onChange={(e) => setNext(e.target.value)} placeholder="••••••••" />
                  </Field>
                  <Field label="تأكيد الجديدة">
                    <Input dir="ltr" type="password" className="num" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" />
                  </Field>
                </div>
                <Btn variant="primary" size="sm" onClick={changePassword} loading={savingPw} disabled={!cur || next.length < 6 || confirm.length < 6}>
                  تغيير كلمة المرور
                </Btn>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* backup */}
      <div className="space-y-4 self-start">
        {/* ===== تحكم الأدمن المطلق: العملات + التوصيل + إظهار الأقسام ===== */}
        {isAdmin && (
          <Card
            className="anim-in anim-d1"
            title="إعدادات الأدمن: العملات والتوصيل والصلاحيات"
            icon={<Banknote size={16} />}
            bodyClass="space-y-4 p-5"
          >
            {!settings ? (
              <div className="space-y-3">
                <Skeleton className="h-11" />
                <Skeleton className="h-11" />
              </div>
            ) : (
              <>
                <Field label="العملة الافتراضية للنظام" hint="تُستخدم عند إنشاء الفواتير الجديدة">
                  <Select value={draft.defaultCurrency} onChange={(e) => setDraft((d) => ({ ...d, defaultCurrency: e.target.value as CurrencyCode }))}>
                    {(Object.keys(CURRENCIES) as CurrencyCode[]).map((c) => (
                      <option key={c} value={c}>{c} — {CURRENCIES[c].label}</option>
                    ))}
                  </Select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="سعر الصرف: دولار لكل دينار (USD)" hint="افتراضي 1.41">
                    <Input dir="ltr" type="number" step="any" min="0" className="num" value={String(draft.rateUSD)} onChange={(e) => setDraft((d) => ({ ...d, rateUSD: Number(e.target.value) }))} />
                  </Field>
                  <Field label="سعر الصرف: جنيه لكل دينار (EGP)" hint="افتراضي 67.5">
                    <Input dir="ltr" type="number" step="any" min="0" className="num" value={String(draft.rateEGP)} onChange={(e) => setDraft((d) => ({ ...d, rateEGP: Number(e.target.value) }))} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="التوصيل الداخلي (ثابت بالدينار)" hint="افتراضي 1.5">
                    <Input dir="ltr" type="number" step="any" min="0" className="num" value={String(draft.shippingInternal)} onChange={(e) => setDraft((d) => ({ ...d, shippingInternal: Number(e.target.value) }))} />
                  </Field>
                  <Field label="التوصيل الخارجي (ثابت بالدينار)" hint="افتراضي 2">
                    <Input dir="ltr" type="number" step="any" min="0" className="num" value={String(draft.shippingExternal)} onChange={(e) => setDraft((d) => ({ ...d, shippingExternal: Number(e.target.value) }))} />
                  </Field>
                </div>
                <div className="space-y-2">
                  <p className="text-[12px] font-extrabold text-[var(--muted)]">إظهار / إخفاء الأقسام عن المستخدمين العاديين (abood / hasan…)</p>
                  <Toggle value={draft.showProductsForUsers} onChange={(v) => setDraft((d) => ({ ...d, showProductsForUsers: v }))} label="الأصناف والمخزون" hint="إخفاؤها يمنع المستخدم من فتح الصفحة" />
                  <Toggle value={draft.showClientsForUsers} onChange={(v) => setDraft((d) => ({ ...d, showClientsForUsers: v }))} label="العملاء" hint="إخفاؤها يمنع المستخدم من فتح الصفحة" />
                  <Toggle value={draft.showReportsForUsers} onChange={(v) => setDraft((d) => ({ ...d, showReportsForUsers: v }))} label="التقارير" hint="إخفاؤها يمنع المستخدم من فتح الصفحة" />
                  <p className="pt-1.5 text-[12px] font-extrabold text-[var(--muted)]">
                    صلاحيات الموظفين في بيانات العملاء (abood / hasan)
                  </p>
                  <Toggle
                    value={draft.allowUsersEditClients}
                    onChange={(v) => setDraft((d) => ({ ...d, allowUsersEditClients: v }))}
                    label="تصحيح أرقام الهواتف وإضافة رقم هاتف ثانٍ"
                    hint="تفعيلها يسمح للموظف بإضافة عميل جديد وتعديل أرقام الهواتف والعنوان والملاحظات — أما الاسم والنوع والحذف فتبقى للمدير"
                    onLabel="مُفعّلة"
                    offLabel="موقوفة"
                  />
                  <p className="text-[11px] font-semibold leading-5 text-[var(--faint)]">
                    كل تعديل يجري على بيانات عميل يُسجَّل في سجل النشاط باسم الموظف
                    (القيمة القديمة ← الجديدة) لمراجعة الأدمن.
                  </p>
                  <p className="text-[11px] font-semibold leading-5 text-[var(--faint)]">ملاحظة: الكلف والأرباح مخفية نهائيًا عن المستخدمين العاديين في كل الصفحات والـ API — وصلاحياتهم محصورة بإنشاء فواتير البيع فقط.</p>
                </div>
                <Btn variant="primary" onClick={saveSettings} loading={savingSettings}>حفظ إعدادات الأدمن</Btn>
              </>
            )}
          </Card>
        )}

        <Card
          className="anim-in anim-d1"
          title="عملة العرض"
          icon={<Banknote size={16} />}
          bodyClass="space-y-3 p-5"
        >
          <p className="text-[12.5px] font-semibold leading-7 text-[var(--muted)]">
            اختر عملة العرض (دينار JOD / دولار USD / جنيه EGP) — التحويل فوري في
            الفواتير والحسابات والتقارير، والتخزين دائمًا بالدينار.
          </p>
          <CurrencySwitcher defaultCurrency={settings?.defaultCurrency ?? draft.defaultCurrency} />
        </Card>
        <Card
          className="anim-in anim-d1"
          title="النسخ الاحتياطي"
          icon={<DatabaseBackup size={16} />}
          bodyClass="space-y-4 p-5"
        >
          <p className="text-[12.5px] font-semibold leading-7 text-[var(--muted)]">
            صدّر نسخة كاملة من قاعدة البيانات (الأصناف، العملاء، الفواتير،
            المستخدمون، سجل النشاط) بصيغة JSON واحفظها في مكان آمن. يُنصح بأخذ
            نسخة <span className="text-[var(--text)]">يوميًا أو أسبوعيًا</span> على
            الأقل — والنسخة لا تتضمن كلمات المرور لأسباب أمنية.
          </p>
          {me?.role === "admin" ? (
            <>
              <Btn variant="primary" onClick={downloadBackup}>
                <Download size={16} /> تنزيل نسخة احتياطية الآن
              </Btn>
              <div className="flex items-center gap-2 text-[11.5px] font-bold text-[var(--faint)]">
                <CalendarClock size={14} />
                {lastBackup ? (
                  <span>
                    آخر نسخة من هذا الجهاز:{" "}
                    <span className="text-[var(--muted)]">{fmtDateTime(lastBackup)}</span>
                  </span>
                ) : (
                  "لم يتم أخذ نسخة من هذا الجهاز بعد"
                )}
              </div>
            </>
          ) : (
            <Badge tone="slate">
              <ShieldCheck size={12} /> تنزيل النسخ متاح للمدير فقط
            </Badge>
          )}
        </Card>

        <Card
          className="anim-in anim-d2"
          title="حول النظام"
          icon={<Info size={16} />}
          bodyClass="p-5"
        >
          <ul className="space-y-2.5 text-[12.5px] font-semibold leading-6 text-[var(--muted)]">
            <li className="flex gap-2">
              <span className="glow-dot mt-2 shrink-0" />
              نظام «Cloud Culture» v1.0 — إدارة مبيعات ومخزون المنتجات.
            </li>
            <li className="flex gap-2">
              <span className="glow-dot mt-2 shrink-0" />
              المخزون يُخصم تلقائيًا مع كل فاتورة، ويُسترجع عند إلغائها — وكل حركة مسجلة باسم منفذها في سجل النشاط.
            </li>
            <li className="flex gap-2">
              <span className="glow-dot mt-2 shrink-0" />
              كلمات المرور مشفّرة بخوارزمية bcrypt، وتسجيل الدخول محمي بحد أقصى للمحاولات.
            </li>
            <li className="flex gap-2">
              <span className="glow-dot mt-2 shrink-0" />
              الفواتير قابلة للطباعة أو الحفظ PDF من نافذة الطباعة مباشرة.
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
