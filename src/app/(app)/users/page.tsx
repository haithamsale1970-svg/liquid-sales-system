"use client";

import { useEffect, useState } from "react";
import {
  KeyRound,
  Plus,
  ShieldCheck,
  Trash2,
  UserCog,
  UsersRound,
} from "lucide-react";
import { api } from "@/lib/client";
import { useToast } from "@/components/toast";
import {
  Badge,
  Btn,
  Card,
  ConfirmDialog,
  Empty,
  Field,
  Input,
  Modal,
  Select,
  Skeleton,
} from "@/components/ui";
import { cls, fmtDate, fmtNum, initials, type SessionUserDTO } from "@/lib/shared";

type UserRow = {
  id: number;
  username: string;
  name: string;
  role: "admin" | "user";
  createdAt: string;
  salesCount: number;
};

export default function UsersPage() {
  const toast = useToast();
  const [me, setMe] = useState<SessionUserDTO | null>(null);
  const [rows, setRows] = useState<UserRow[] | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ username: "", name: "", password: "", role: "user" });
  const [saving, setSaving] = useState(false);

  const [pwTarget, setPwTarget] = useState<UserRow | null>(null);
  const [newPw, setNewPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    try {
      setRows(await api<UserRow[]>("/api/users"));
    } catch (e) {
      if (e instanceof Error && e.message.includes("المدير")) setForbidden(true);
      else toast.push("err", e instanceof Error ? e.message : "تعذر التحميل");
      setRows([]);
    }
  }

  useEffect(() => {
    api<SessionUserDTO>("/api/auth/me").then(setMe).catch(() => {});
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createUser() {
    if (saving) return;
    setSaving(true);
    try {
      await api("/api/users", { method: "POST", body: form });
      toast.push("ok", `تم إنشاء حساب "${form.username}"`);
      setCreateOpen(false);
      setForm({ username: "", name: "", password: "", role: "user" });
      await load();
    } catch (e) {
      toast.push("err", e instanceof Error ? e.message : "تعذر الإنشاء");
    } finally {
      setSaving(false);
    }
  }

  async function changeRole(u: UserRow, role: string) {
    try {
      await api(`/api/users/${u.id}`, { method: "PATCH", body: { role } });
      toast.push("ok", `تم تحديث صلاحية "${u.name}"`);
      await load();
    } catch (e) {
      toast.push("err", e instanceof Error ? e.message : "تعذر التحديث");
      await load();
    }
  }

  async function resetPassword() {
    if (!pwTarget || pwSaving) return;
    setPwSaving(true);
    try {
      await api(`/api/users/${pwTarget.id}`, { method: "PATCH", body: { password: newPw } });
      toast.push("ok", `تم تعيين كلمة مرور جديدة لـ "${pwTarget.name}"`);
      setPwTarget(null);
      setNewPw("");
    } catch (e) {
      toast.push("err", e instanceof Error ? e.message : "تعذر التعيين");
    } finally {
      setPwSaving(false);
    }
  }

  async function doDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await api(`/api/users/${deleteTarget.id}`, { method: "DELETE" });
      toast.push("ok", `تم حذف "${deleteTarget.username}"`);
      setDeleteTarget(null);
      await load();
    } catch (e) {
      toast.push("err", e instanceof Error ? e.message : "تعذر الحذف");
    } finally {
      setDeleting(false);
    }
  }

  if (forbidden) {
    return (
      <Card>
        <Empty
          icon={<ShieldCheck size={22} />}
          title="هذه الصفحة للمدير فقط"
          hint="إدارة المستخدمين والصلاحيات تتطلب حساب ماستر"
        />
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="anim-in flex flex-wrap items-center justify-between gap-2.5">
        <p className="text-[13px] font-bold text-[var(--muted)]">
          حسابات الدخول للنظام — المدير يملك كل الصلاحيات، والشركاء يديرون العمليات اليومية
        </p>
        <Btn variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
          <Plus size={15} /> مستخدم جديد
        </Btn>
      </div>

      <Card className="anim-in anim-d1 overflow-hidden" bodyClass="overflow-x-auto">
        {!rows ? (
          <div className="space-y-3 p-5">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : rows.length === 0 ? (
          <Empty icon={<UsersRound size={22} />} title="لا يوجد مستخدمون" />
        ) : (
          <table className="tbl min-w-[760px]">
            <thead>
              <tr>
                <th>المستخدم</th>
                <th>اسم الدخول</th>
                <th>الصلاحية</th>
                <th>الفواتير</th>
                <th>تاريخ الإنشاء</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => {
                const isSelf = me?.id === u.id;
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[12px] font-extrabold"
                          style={{
                            background: u.role === "admin" ? "linear-gradient(135deg,#37f2c4,#19c492)" : "rgba(255,255,255,.07)",
                            color: u.role === "admin" ? "#052018" : "var(--muted)",
                          }}
                        >
                          {initials(u.name)}
                        </div>
                        <div>
                          <span className="font-extrabold">{u.name}</span>
                          {isSelf && <Badge tone="mint" className="ms-2">أنت</Badge>}
                        </div>
                      </div>
                    </td>
                    <td><span className="num text-[12.5px] font-bold text-[var(--muted)]">@{u.username}</span></td>
                    <td>
                      <Select
                        value={u.role}
                        disabled={isSelf}
                        onChange={(e) => changeRole(u, e.target.value)}
                        className="!w-auto !py-1.5 !text-[12px]"
                      >
                        <option value="admin">مدير (ماستر)</option>
                        <option value="user">مستخدم (شريك)</option>
                      </Select>
                    </td>
                    <td><span className="num font-black">{fmtNum(u.salesCount)}</span></td>
                    <td><span className="text-[12px] font-bold text-[var(--faint)]">{fmtDate(u.createdAt)}</span></td>
                    <td>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          className="icon-btn"
                          title="تعيين كلمة مرور"
                          onClick={() => {
                            setPwTarget(u);
                            setNewPw("");
                          }}
                        >
                          <KeyRound size={14} />
                        </button>
                        {!isSelf && (
                          <button className="icon-btn danger" title="حذف" onClick={() => setDeleteTarget(u)}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {/* create modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="إنشاء مستخدم جديد" icon={<UserCog size={17} />}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="اسم الدخول *" hint="إنجليزي/أرقام بدون مسافات">
              <Input dir="ltr" className="num" value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} placeholder="partner1" />
            </Field>
            <Field label="الاسم المعروض *">
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="أحمد محمد" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="كلمة المرور *" hint="6 أحرف على الأقل — تُخزّن مشفّرة">
              <Input dir="ltr" type="password" className="num" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="••••••••" />
            </Field>
            <Field label="الصلاحية">
              <Select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                <option value="user">مستخدم (شريك)</option>
                <option value="admin">مدير (ماستر)</option>
              </Select>
            </Field>
          </div>
          <div className="flex justify-end gap-2 border-t border-[var(--line-soft)] pt-4">
            <Btn onClick={() => setCreateOpen(false)}>إلغاء</Btn>
            <Btn
              variant="primary"
              onClick={createUser}
              loading={saving}
              disabled={!/^[a-z0-9_.-]{3,30}$/i.test(form.username) || form.name.trim().length < 2 || form.password.length < 6}
            >
              إنشاء الحساب
            </Btn>
          </div>
        </div>
      </Modal>

      {/* reset password modal */}
      <Modal open={!!pwTarget} onClose={() => setPwTarget(null)} title={pwTarget ? `كلمة مرور جديدة لـ ${pwTarget.name}` : ""} icon={<KeyRound size={17} />}>
        <div className="space-y-4">
          <p className="text-[12.5px] font-semibold leading-6 text-[var(--muted)]">
            سيتم إنهاء جميع جلسات هذا المستخدم الحالية وسيُطلب منه الدخول بكلمة المرور الجديدة.
          </p>
          <Field label="كلمة المرور الجديدة">
            <Input dir="ltr" type="text" className="num" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="6 أحرف على الأقل" autoFocus />
          </Field>
          <div className="flex justify-end gap-2 border-t border-[var(--line-soft)] pt-4">
            <Btn onClick={() => setPwTarget(null)}>إلغاء</Btn>
            <Btn variant="primary" onClick={resetPassword} loading={pwSaving} disabled={newPw.length < 6}>
              تعيين كلمة المرور
            </Btn>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={doDelete}
        loading={deleting}
        title="حذف المستخدم"
        message={`سيتم حذف حساب "${deleteTarget?.username}" نهائيًا وإنهاء جلساته. المستخدمون المرتبطون بفواتير لا يمكن حذفهم حفاظًا على سلامة السجلات.`}
        confirmText="حذف"
      />
    </div>
  );
}
