import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/cairo";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cloud Culture — نظام إدارة المبيعات والمخزون",
  description:
    "Cloud Culture: نظام متكامل لإدارة المنتجات: أصناف، عملاء، فواتير، صلاحيات، تقارير ونسخ احتياطي.",
};

export const viewport: Viewport = {
  themeColor: "#050505",
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
