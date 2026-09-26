/**
 * لوحة شعار Cloud Culture محسّنة للهوية البصرية (SVG).
 * تُستخدم في صفحة الدخول.
 */

export function BrandMark({
  size = 56,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const gid = `cc${size}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      aria-hidden
    >
      <defs>
        {/* ألوان الهوية مربوطة بنظام الثيم: أحمر في الداكن، فسفوري في الفاتح */}
        <linearGradient id={`${gid}-g`} x1="8" y1="6" x2="58" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--brand-1)" />
          <stop offset="0.45" stopColor="var(--brand-2)" />
          <stop offset="1" stopColor="var(--brand-3)" />
        </linearGradient>
        <radialGradient id={`${gid}-glow`} cx="32" cy="28" r="30" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--brand-1)" stopOpacity="0.35" />
          <stop offset="1" stopColor="var(--brand-3)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill="var(--brand-3)" />
      <rect width="64" height="64" rx="18" fill={`url(#${gid}-glow)`} />
      <rect
        x="1.25"
        y="1.25"
        width="61.5"
        height="61.5"
        rx="16.5"
        fill="none"
        stroke={`url(#${gid}-g)`}
        strokeWidth="1.6"
        opacity="0.85"
      />
      {/* قطرة البخار */}
      <path
        d="M32 9.5c5.6 8.2 10.2 13.4 10.2 19.2a10.2 10.2 0 1 1-20.4 0C21.8 22.9 26.4 17.7 32 9.5z"
        fill={`url(#${gid}-g)`}
      />
      <circle cx="28.6" cy="30.2" r="2.4" fill="var(--brand-3)" opacity="0.35" />
      {/* سحابة */}
      <path
        d="M18.5 42.5c-4.6 0-8.3 3.2-8.3 7.3 0 4.2 3.7 7.4 8.3 7.4h26.2c5.1 0 9.3-3.6 9.3-8.2 0-4.3-3.5-7.8-8-8.3-1.3-5.2-6.4-8.9-12.4-8.9-5.4 0-10.1 2.9-12.2 7.2-1-.3-1.9-.5-2.9-.5z"
        fill={`url(#${gid}-g)`}
      />
    </svg>
  );
}
