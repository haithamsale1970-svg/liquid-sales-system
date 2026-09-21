"use client";

import { CheckCircle2, CircleAlert, Info } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ToastType = "ok" | "err" | "info";
type Toast = { id: number; type: ToastType; msg: string };

const Ctx = createContext<{ push: (type: ToastType, msg: string) => void }>({
  push: () => {},
});

export function useToast() {
  return useContext(Ctx);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(1);

  const push = useCallback((type: ToastType, msg: string) => {
    const id = idRef.current++;
    setToasts((t) => [...t.slice(-3), { id, type, msg }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 4200);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="fixed bottom-5 start-5 z-[130] flex max-w-[92vw] flex-col gap-2.5">
        {toasts.map((t) => (
          <div key={t.id} className="toast" role="status">
            {t.type === "ok" && (
              <CheckCircle2 size={17} className="shrink-0 text-[var(--mint)]" />
            )}
            {t.type === "err" && (
              <CircleAlert size={17} className="shrink-0 text-[var(--danger)]" />
            )}
            {t.type === "info" && (
              <Info size={17} className="shrink-0 text-[var(--sky)]" />
            )}
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
