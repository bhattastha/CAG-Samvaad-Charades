/** Sahayika: a friendly girl in a graduation cap (no archery imagery). */
export function SahayikaAvatar({ size = 56, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
      <circle cx="32" cy="32" r="31" fill="#E8590C" />
      <circle cx="32" cy="32" r="31" fill="url(#hcShade)" />
      <defs>
        <radialGradient id="hcShade" cx="30%" cy="25%" r="80%"><stop offset="0" stopColor="#fff" stopOpacity=".35" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
      </defs>
      {/* hair */}
      <path d="M15 38c0-12 7-19 17-19s17 7 17 19c0 6-2 11-4 14H19c-2-3-4-8-4-14z" fill="#2B1B17" />
      {/* face */}
      <ellipse cx="32" cy="37" rx="12" ry="13" fill="#F2C39B" />
      <path d="M20 33c3-6 8-8 12-8s9 2 12 8c-4-2-8-4-12-4s-8 2-12 4z" fill="#2B1B17" />
      <circle cx="27.5" cy="37" r="1.6" fill="#22293B" />
      <circle cx="36.5" cy="37" r="1.6" fill="#22293B" />
      <circle cx="24.5" cy="41.5" r="2" fill="#F59E8B" opacity=".6" />
      <circle cx="39.5" cy="41.5" r="2" fill="#F59E8B" opacity=".6" />
      <path d="M28 43c2 2.4 6 2.4 8 0" stroke="#B42318" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <circle cx="32" cy="31.5" r="1" fill="#C2410C" />
      {/* graduation cap */}
      <path d="M12 21l20-9 20 9-20 9z" fill="#1E3A8A" />
      <path d="M21 24v5c6 4 16 4 22 0v-5l-11 5z" fill="#22293B" />
      <path d="M50 22v9" stroke="#F59E0B" strokeWidth="1.6" />
      <circle cx="50" cy="32" r="2" fill="#F59E0B" />
    </svg>
  );
}
