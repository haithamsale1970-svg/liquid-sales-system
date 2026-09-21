import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // مكتبة pg تتصل بـ PostgreSQL عبر TCP، لذلك نُبقيها خارج حزمة السيرفر
  // (مطلوبة لبيئات Vercel/Serverless حتى لا يفشل البناء أو الاتصال).
  serverExternalPackages: ["pg"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
        ],
      },
    ];
  },
};

export default nextConfig;
