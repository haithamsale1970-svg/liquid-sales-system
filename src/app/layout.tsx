import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/cairo";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cloud Culture — نظام إدارة المبيعات والمخزون",
  description:
    "Cloud Culture: نظام متكامل لإدارة المنتجات: أصناف، عملاء، فواتير، صلاحيات، تقارير ونسخ احتياطي.",
  applicationName: "Cloud Culture",
  appleWebApp: {
    capable: true,
    title: "Cloud Culture",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icon", type: "image/png", sizes: "512x512" },
      { url: "/icon-192", type: "image/png", sizes: "192x192" },
    ],
    apple: [{ url: "/apple-icon", type: "image/png", sizes: "180x180" }],
    shortcut: ["/icon-192"],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#070202" },
    { media: "(prefers-color-scheme: light)", color: "#8f0000" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
