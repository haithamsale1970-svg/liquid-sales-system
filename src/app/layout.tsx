import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/cairo";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { THEME_STORAGE_KEY } from "@/lib/theme";

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
    { media: "(prefers-color-scheme: light)", color: "#eef3f0" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

/**
 * سكربت يمنع وميض الثيم الخاطئ عند أول رسم للصفحة.
 * يُنفَّذ قبل أي تنسيق فيحسم لون الخلفية مباشرة من LocalStorage.
 */
const THEME_BOOT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==="dark"||t==="phosphor"){if(t!=="dark"){document.documentElement.setAttribute("data-theme",t);}else{document.documentElement.removeAttribute("data-theme");}}}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
