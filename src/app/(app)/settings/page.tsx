"use client";

import { useEffect, useState } from "react";
import {
  CalendarClock,
  DatabaseBackup,
  Download,
  Info,
  KeyRound,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { api } from "@/lib/client";
import { useToast } from "@/components/toast";
import { Badge, Btn, Card, Field, Input, Skeleton } from "@/components/ui";
import { fmtDateTime, type SessionUserDTO } from "@/lib/shared";

const LAST_BACKUP_KEY = "sohob_last_backup";

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

  useEffect(() => {
    api<SessionUserDTO>("/api/auth/me")
      .then((u) => {
        setMe(u);
        setName(u.name);
      })
      .catch(() => {});
    setLastBackup(typeof window !== "undefined" ? localStorage.getItem(LAST_BACKUP_KEY) : null);
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
                className="flex h-11 w-11 items-center justify-center rounded-xl text-[#052018]"
                style={{ background: "linear-gradient(135deg,#37f2c4,#19c492)" }}
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
              نظام «سُحُب» v1.0 — إدارة مبيعات ومخزون منتجات الليكويد والسجائر الإلكترونية.
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
