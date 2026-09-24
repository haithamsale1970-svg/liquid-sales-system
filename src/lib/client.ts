import { buildXlsx, type Sheet } from "./xlsx";

// Client-side API helper.
export async function api<T = unknown>(
  path: string,
  opts?: { method?: string; body?: unknown },
): Promise<T> {
  const res = await fetch(path, {
    method: opts?.method ?? "GET",
    headers: opts?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined" && !path.includes("/auth/")) {
      window.location.href = "/login";
    }
    throw new Error(data.error || "حدث خطأ غير متوقع");
  }
  return data as T;
}

// Read a file as a compressed JPEG data URL (for product photos).
export function fileToDataUrl(file: File, maxSize = 520): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("تعذرت معالجة الصورة"));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = () => reject(new Error("ملف الصورة غير صالح"));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error("تعذرت قراءة الملف"));
    reader.readAsDataURL(file);
  });
}

export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => `"${String(v).replaceAll('"', '""')}"`;
  const lines = [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))];
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// تنزيل عدة أوراق كملف Excel (.xlsx) حقيقي — بدون أي مكتبة خارجية.
export function downloadXlsx(filename: string, sheets: Sheet[]) {
  const blob = new Blob([buildXlsx(sheets) as unknown as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
