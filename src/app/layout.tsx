import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/cairo";
import "./globals.css";

export const metadata: Metadata = {
  title: "سُحُب — نظام إدارة مبيعات ومخزون الليكويد",
  description:
    "نظام متكامل لإدارة منتجات الليكويد: أصناف، عملاء، فواتير، صلاحيات، تقارير ونسخ احتياطي.",
};

export const viewport: Viewport = {
  themeColor: "#06080b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
