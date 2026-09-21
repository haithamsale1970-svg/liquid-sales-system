import { config as loadEnv } from "dotenv";
import { defineConfig } from "drizzle-kit";
import { resolveDatabaseUrl } from "./src/db/connection";

// يقرأ .env.local ثم .env حتى تعمل أوامر drizzle-kit على قاعدة Neon
// بدون وضع أي رابط داخل الكود.
loadEnv({ path: [".env.local", ".env"], quiet: true });

const resolved = resolveDatabaseUrl(true);

if (!resolved) {
  throw new Error(
    "لم يتم العثور على رابط قاعدة البيانات. أنشئ ملف .env.local في جذر المشروع " +
      "وأضف فيه: DATABASE_URL=postgresql://... (رابط Neon من Connection Details).",
  );
}

console.log(`→ drizzle-kit يستخدم قاعدة البيانات من المتغيّر ${resolved.key}`);

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: resolved.url },
  verbose: true,
});
