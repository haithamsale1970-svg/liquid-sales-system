import { ImageResponse } from "next/og";
import { BrandIconArt } from "@/components/BrandIconArt";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<BrandIconArt size={512} />, { ...size });
}
