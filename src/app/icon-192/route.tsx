import { ImageResponse } from "next/og";
import { BrandIconArt } from "@/components/BrandIconArt";

/** أيقونة تطبيق 192×192 (PWA) — مسار ثابت صالح في جميع المتصفحات. */
export function GET() {
  return new ImageResponse(<BrandIconArt size={192} />, {
    width: 192,
    height: 192,
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
