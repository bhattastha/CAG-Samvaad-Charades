/** Sahayak: the game's guide, drawn as a mission-control emblem (monogram + signal arcs), not a cartoon. */
export function SahayikaAvatar({ size = 56, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="hcSahayakBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1D4E89" />
          <stop offset="1" stopColor="#071A33" />
        </linearGradient>
        <linearGradient id="hcSahayakGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F3E2B0" />
          <stop offset="1" stopColor="#C49B3D" />
        </linearGradient>
      </defs>
      <path d="M32 3l25 14.5v29L32 61 7 46.5v-29z" fill="url(#hcSahayakBg)" stroke="url(#hcSahayakGold)" strokeWidth="2" />
      <path d="M32 9.5l19.5 11.3v22.4L32 54.5 12.5 43.2V20.8z" fill="none" stroke="#ffffff" strokeOpacity=".14" strokeWidth="1.2" />
      <text x="32" y="40" textAnchor="middle" fontSize="23" fontWeight="700" fill="url(#hcSahayakGold)" fontFamily="'Noto Sans Devanagari', sans-serif">स</text>
      <path d="M45 22.5a9 9 0 012.5 6.3M48.5 19a14 14 0 013.5 9.6" stroke="#E85A1A" strokeWidth="2" strokeLinecap="round" fill="none" />
      <circle cx="44" cy="27.5" r="1.6" fill="#E85A1A" />
    </svg>
  );
}
