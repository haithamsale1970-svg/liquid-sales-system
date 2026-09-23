"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client";
import type { AppSettings } from "@/lib/currency";
import { getPreferredCurrency, type CurrencyCode } from "@/lib/currency";

export function useCurrency(): {
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
  settings: AppSettings | null;
  rates: Record<CurrencyCode, number>;
} {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [currency, setCurrencyState] = useState<CurrencyCode>("JOD");

  useEffect(() => {
    api<AppSettings>("/api/settings")
      .then((s) => {
        setSettings(s);
        setCurrencyState(getPreferredCurrency(s.defaultCurrency));
      })
      .catch(() => setCurrencyState(getPreferredCurrency("JOD")));
    const h = (e: Event) => {
      const v = (e as CustomEvent).detail as CurrencyCode;
      if (v) setCurrencyState(v);
    };
    window.addEventListener("cc:currency", h);
    return () => window.removeEventListener("cc:currency", h);
  }, []);

  const rates = useMemo(
    () => ({
      JOD: 1,
      USD: settings?.rateUSD && settings.rateUSD > 0 ? settings.rateUSD : 1.41,
      EGP: settings?.rateEGP && settings.rateEGP > 0 ? settings.rateEGP : 67.5,
    }),
    [settings],
  );

  function setCurrency(c: CurrencyCode) {
    setCurrencyState(c);
    try {
      window.localStorage.setItem("cc_currency", c);
      window.dispatchEvent(new CustomEvent("cc:currency", { detail: c }));
    } catch {}
  }

  return { currency, setCurrency, settings, rates };
}
