"use client";

import { t } from "@/lib/i18n";

import { Check, Minus, ShieldCheck } from "lucide-react";
import { cls } from "@/lib/shared";
import {
  EXTRA_PERMISSIONS,
  PERMISSION_ACTIONS,
  PERMISSION_GROUPS,
  type PermissionAction,
  type PermissionKey,
  type Permissions,
} from "@/lib/permissions";

/** مفتاح تبديل صلاحية واحدة (Switch styled بـ Tailwind). */
function PermToggle({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={cls(
        "relative h-[22px] w-[40px] shrink-0 rounded-full border transition-colors duration-200",
        disabled && "cursor-not-allowed opacity-40",
        checked
          ? "border-transparent bg-[var(--mint)]"
          : "border-[var(--line)] bg-[var(--overlay-2)]",
      )}
    >
      <span
        className={cls(
          "absolute top-[2px] h-[16px] w-[16px] rounded-full bg-white shadow transition-all duration-200",
          checked ? "start-[21px]" : "start-[2px]",
        )}
      />
    </button>
  );
}

function ActionToggle({
  group,
  action,
  perms,
  setPerm,
  locked,
}: {
  group: string;
  action: PermissionAction;
  perms: Permissions;
  setPerm: (key: PermissionKey, value: boolean) => void;
  locked?: boolean;
}) {
  const key = `${group}.${action}` as PermissionKey;
  return (
    <PermToggle
      checked={perms[key] === true}
      disabled={locked}
      onChange={(v) => setPerm(key, v)}
      label={PERMISSION_ACTIONS[action]}
    />
  );
}

/**
 * لوحة تحكم الصلاحيات: جدول صفوفه الأقسام (الصفحات) وأعمدته الإجراءات
 * (عرض/إضافة/تعديل/حذف)، يتبعه قسم للصلاحيات الدقيقة الإضافية.
 */
export default function PermissionsMatrix({
  perms,
  onChange,
  locked = false,
  lockedHint,
}: {
  perms: Permissions;
  onChange: (next: Permissions) => void;
  /** يمنع التعديل (حساب المدير يملك كل الصلاحيات). */
  locked?: boolean;
  lockedHint?: string;
}) {
  function setPerm(key: PermissionKey, value: boolean) {
    if (locked) return;
    onChange({ ...perms, [key]: value });
  }

  /** تفعيل/تعطيل كل إجراءات صف معًا. */
  function setGroup(group: string, value: boolean) {
    if (locked) return;
    const g = PERMISSION_GROUPS.find((x) => x.key === group);
    if (!g) return;
    const next = { ...perms };
    for (const a of g.actions) next[`${group}.${a}`] = value;
    onChange(next);
  }

  function setAll(value: boolean) {
    if (locked) return;
    onChange(Object.fromEntries(Object.keys(perms).map((k) => [k, value])));
  }

  const grantedCount = Object.values(perms).filter(Boolean).length;

  return (
    <div className="space-y-4">
      {locked && (
        <p className="flex items-center gap-2 rounded-xl border border-[var(--line-soft)] bg-[var(--overlay-2)] px-3 py-2.5 text-[12.5px] font-bold text-[var(--muted)]">
          <ShieldCheck size={15} className="text-[var(--mint)]" />
          {lockedHint ?? "هذا الحساب يملك كل الصلاحيات ولا يمكن تقييده."}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[12.5px] font-extrabold">
          الصلاحيات الممنوحة:{" "}
          <span className="num text-[var(--mint)]">{grantedCount}</span>
        </span>
        {!locked && (
          <div className="flex items-center gap-1.5">
            <button type="button" className="btn btn-xs" onClick={() => setAll(true)}>
              <Check size={12} /> تفعيل الكل
            </button>
            <button type="button" className="btn btn-xs" onClick={() => setAll(false)}>
              <Minus size={12} /> إلغاء الكل
            </button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="tbl min-w-[620px]">
          <thead>
            <tr>
              <th>{t("القسم / الصفحة")}</th>
              {(Object.keys(PERMISSION_ACTIONS) as PermissionAction[]).map((a) => (
                <th key={a} className="text-center">
                  {PERMISSION_ACTIONS[a]}
                </th>
              ))}
              <th className="text-center">{t("الكامل")}</th>
            </tr>
          </thead>
          <tbody>
            {PERMISSION_GROUPS.map((g) => {
              const allOn = g.actions.every((a) => perms[`${g.key}.${a}`] === true);
              return (
                <tr key={g.key}>
                  <td>
                    <div className="font-extrabold">{g.label}</div>
                    <div className="text-[11.5px] font-semibold text-[var(--faint)]">
                      {g.hint}
                    </div>
                  </td>
                  {g.actions.map((a) => (
                    <td key={a} className="text-center">
                      <div className="flex justify-center">
                        <ActionToggle
                          group={g.key}
                          action={a}
                          perms={perms}
                          setPerm={setPerm}
                          locked={locked}
                        />
                      </div>
                    </td>
                  ))}
                  <td className="text-center">
                    <div className="flex justify-center">
                      <PermToggle
                        checked={allOn}
                        disabled={locked}
                        onChange={(v) => setGroup(g.key, v)}
                        label={`كل صلاحيات ${g.label}`}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div>
        <p className="mb-2 text-[12.5px] font-extrabold">صلاحيات إضافية دقيقة</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {EXTRA_PERMISSIONS.map((p) => (
            <div
              key={p.key}
              className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line-soft)] bg-[var(--overlay-1)] px-3 py-2.5"
            >
              <div className="min-w-0">
                <div className="text-[12.5px] font-extrabold">{p.label}</div>
                <div className="text-[11.5px] font-semibold text-[var(--faint)]">
                  {p.hint}
                </div>
              </div>
              <PermToggle
                checked={perms[p.key] === true}
                disabled={locked}
                onChange={(v) => setPerm(p.key, v)}
                label={p.label}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
