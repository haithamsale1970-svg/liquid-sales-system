"use client";

import { Loader2, TriangleAlert, X } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { cls } from "@/lib/shared";

export function Spinner({
  size = 16,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return <Loader2 size={size} className={cls("animate-spin", className)} />;
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
  size?: "sm" | "xs" | "md";
  loading?: boolean;
};

export function Btn({
  variant = "ghost",
  size = "md",
  loading,
  children,
  className,
  disabled,
  ...rest
}: BtnProps) {
  return (
    <button
      className={cls(
        "btn",
        variant === "primary" && "btn-primary",
        variant === "danger" && "btn-danger",
        variant === "ghost" && "btn-ghost",
        size === "sm" && "btn-sm",
        size === "xs" && "btn-xs",
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner size={14} />}
      {children}
    </button>
  );
}

export function Input({
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cls("inp", className)} {...rest} />;
}

export function Select({
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cls("inp", className)} {...rest}>
      {children}
    </select>
  );
}

export function Textarea({
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cls("inp", className)} {...rest} />;
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="lbl">{label}</label>
      {children}
      {hint && (
        <p className="mt-1.5 text-[11.5px] font-medium text-[var(--faint)]">
          {hint}
        </p>
      )}
    </div>
  );
}

export const TONES: Record<string, string> = {
  mint: "badge-mint",
  violet: "badge-violet",
  amber: "badge-amber",
  rose: "badge-rose",
  sky: "badge-sky",
  slate: "badge-slate",
};
export type Tone = keyof typeof TONES;

export function Badge({
  tone = "slate",
  children,
  className,
}: {
  tone?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cls("badge", TONES[tone] ?? TONES.slate, className)}>
      {children}
    </span>
  );
}

export function Card({
  title,
  icon,
  actions,
  children,
  className,
  bodyClass,
}: {
  title?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClass?: string;
}) {
  return (
    <section className={cls("panel", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line-soft)] px-5 py-3.5">
          <h2 className="flex items-center gap-2.5 text-[14.5px] font-extrabold">
            {icon && <span className="text-[var(--mint)]">{icon}</span>}
            {title}
          </h2>
          {actions}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

export function Modal({
  open,
  onClose,
  title,
  icon,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", h);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!mounted || !open) return null;
  return createPortal(
    <div className="modal-back" onMouseDown={onClose}>
      <div
        className={cls("modal-card", wide ? "max-w-3xl" : "max-w-lg")}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 border-b border-[var(--line-soft)] px-6 py-4">
          <h3 className="flex items-center gap-2.5 text-[15px] font-extrabold">
            {icon && <span className="text-[var(--mint)]">{icon}</span>}
            {title}
          </h3>
          <button className="icon-btn" onClick={onClose} aria-label="إغلاق">
            <X size={16} />
          </button>
        </header>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  loading,
  confirmText = "تأكيد",
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  loading?: boolean;
  confirmText?: string;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      icon={<TriangleAlert size={17} className="text-[var(--danger)]" />}
    >
      <p className="text-sm font-semibold leading-7 text-[var(--muted)]">
        {message}
      </p>
      <div className="mt-6 flex justify-end gap-2">
        <Btn onClick={onClose}>تراجع</Btn>
        <Btn variant="danger" onClick={onConfirm} loading={loading}>
          {confirmText}
        </Btn>
      </div>
    </Modal>
  );
}

export function Empty({
  icon,
  title,
  hint,
  action,
}: {
  icon: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <div
        className="kpi-icon text-[var(--muted)]"
        style={{
          background: "rgba(255,255,255,.05)",
          border: "1px solid var(--line-soft)",
        }}
      >
        {icon}
      </div>
      <p className="mt-1.5 text-sm font-extrabold">{title}</p>
      {hint && <p className="text-xs font-semibold text-[var(--faint)]">{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cls("skeleton", className)} />;
}

export function useCountUp(target: number, duration = 850): number {
  const [val, setVal] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const from = prev.current;
    if (from === target) return;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      setVal(from + (target - from) * e);
      if (p < 1) raf = requestAnimationFrame(tick);
      else prev.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}
