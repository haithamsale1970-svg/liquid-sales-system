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
  DEFAULT_LANG,
  applyLang,
  readStoredLang,
  translate,
  type Lang,
} from "@/lib/i18n";

type LangCtx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
  /** دالة ترجمة: t("لوحة التحكم") */
  t: (text: string) => string;
};

const Ctx = createContext<LangCtx>({
  lang: DEFAULT_LANG,
  setLang: () => {},
  toggle: () => {},
  t: (x) => x,
});

/** الوصول للغة والترجمة من أي مكوّن داخل التطبيق. */
export function useLang(): LangCtx {
  return useContext(Ctx);
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);

  useEffect(() => {
    const stored = readStoredLang();
    setLangState(stored);
    applyLang(stored);
  }, []);

  // مزامنة بين التبويبات
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === "cc-lang") {
        const v = readStoredLang();
        setLangState(v);
        applyLang(v);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    applyLang(l);
  }, []);

  const toggle = useCallback(() => {
    setLangState((prev) => {
      const next: Lang = prev === "ar" ? "en" : "ar";
      applyLang(next);
      return next;
    });
  }, []);

  const tFn = useCallback((text: string) => translate(lang, text), [lang]);

  const value = useMemo(
    () => ({ lang, setLang, toggle, t: tFn }),
    [lang, setLang, toggle, tFn],
  );

  // إعادة التركيب عند تغيير اللغة تضمن تحديث كل نصوص t() في الشجرة كلها،
  // بما فيها النصوص داخل الصفحات التي لا تستهلك سياق React.
  return <Ctx.Provider value={value}><div key={lang} className="contents">{children}</div></Ctx.Provider>;
}
