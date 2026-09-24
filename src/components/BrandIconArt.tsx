/**
 * رسم شعار Cloud Culture بصيغة متوافقة مع محرّك Satori (next/og).
 * يُستخدم لتوليد أيقونات التطبيق (PWA) بأحجام 192 / 512 و apple-icon 180.
 * الخلفية داكنة فاخرة والشعار أحمر أصلي — بدون حرف C باهت.
 */
export function BrandIconArt({ size = 512 }: { size?: number }) {
  const plate = Math.round(size * 0.82);
  const mark = Math.round(size * 0.6);
  const stroke = Math.max(1, Math.round(size * 0.008));

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "linear-gradient(160deg, #220707 0%, #0c0202 55%, #050000 100%)",
      }}
    >
      <div
        style={{
          width: plate,
          height: plate,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: Math.round(size * 0.22),
          border: `${stroke}px solid rgba(255, 77, 77, 0.32)`,
          background:
            "linear-gradient(180deg, rgba(255, 43, 43, 0.16) 0%, rgba(0, 0, 0, 0) 100%)",
        }}
      >
        <svg width={mark} height={mark} viewBox="0 0 64 64">
          {/* قطرة البخار */}
          <path
            d="M32 9.5c5.6 8.2 10.2 13.4 10.2 19.2a10.2 10.2 0 1 1-20.4 0C21.8 22.9 26.4 17.7 32 9.5z"
            fill="#ff3b3b"
          />
          <circle cx="28.6" cy="30.2" r="2.4" fill="#5c0000" opacity="0.4" />
          {/* سحابة */}
          <path
            d="M18.5 42.5c-4.6 0-8.3 3.2-8.3 7.3 0 4.2 3.7 7.4 8.3 7.4h26.2c5.1 0 9.3-3.6 9.3-8.2 0-4.3-3.5-7.8-8-8.3-1.3-5.2-6.4-8.9-12.4-8.9-5.4 0-10.1 2.9-12.2 7.2-1-.3-1.9-.5-2.9-.5z"
            fill="#c40000"
          />
          <path
            d="M18.5 42.5c-4.6 0-8.3 3.2-8.3 7.3 0 4.2 3.7 7.4 8.3 7.4h9.1c-1.3-3.1-2-6.6-2-10.3 0-1.5.1-2.9.4-4.3-2.4-.1-4.8-.1-7.5-.1z"
            fill="#e52424"
            opacity="0.55"
          />
        </svg>
      </div>
    </div>
  );
}
