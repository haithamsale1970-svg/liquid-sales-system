"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  applyTheme,
  readStoredTheme,
  toggleTheme,
  type ThemeId,
} from "@/lib/theme";

type ThemeCtx = {
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
  toggle: () => void;
};

const Ctx = createContext<ThemeCtx>({
  theme: DEFAULT_THEME,
  setTheme: () => {},
  toggle: () => {},
});

/** يتيح قراءة/تغيير الثيم من أي مكان داخل التطبيق. */
export function useTheme(): ThemeCtx {
  return useContext(Ctx);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME);

  // مزامنة الحالة مع ما هو مطبَّق فعليًا (بعد سكربت ما-قبل-الرسم).
  useEffect(() => {
    setThemeState(readStoredTheme());
  }, []);

  // استجابة لتغيير الثيم من تبويب/نافذة أخرى.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === THEME_STORAGE_KEY) setThemeState(readStoredTheme());
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setTheme = useCallback((t: ThemeId) => {
    setThemeState(t);
    applyTheme(t);
  }, []);

  const toggle = useCallback(() => {
    setThemeState((prev) => {
      const next = toggleTheme(prev);
      applyTheme(next);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ theme, setTheme, toggle }), [theme, setTheme, toggle]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
