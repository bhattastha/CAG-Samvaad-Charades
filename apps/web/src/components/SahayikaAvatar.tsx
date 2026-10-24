/**
 * Sahayak, the game guide: the approved mascot (supplied render), never redrawn.
 * Avatar = circular head-and-shoulders crop, picked by size (64 / 128 / 256 px sources stay sharp on retina).
 * SahayakFigure = the waist-up render for guide cards and the landing hero.
 */
export function SahayikaAvatar({ size = 56, className = "", ring = true }: { size?: number; className?: string; ring?: boolean }) {
  const src = size <= 40 ? "/landing/sahayak-avatar-64.png" : size <= 96 ? "/landing/sahayak-avatar-128.png" : "/landing/sahayak-avatar-256.png";
  return (
    <img src={src} alt="" aria-hidden width={size} height={size} draggable={false}
      className={`rounded-full object-cover select-none shrink-0 ${ring ? "ring-2 ring-white shadow-[0_0_0_3px_rgba(214,166,66,.55)]" : ""} ${className}`}
      style={{ width: size, height: size }} />
  );
}

export function SahayakFigure({ height = 160, className = "" }: { height?: number; className?: string }) {
  return (
    <img src="/landing/sahayak-half.webp" alt="" aria-hidden draggable={false} height={height}
      className={`w-auto select-none pointer-events-none ${className}`} style={{ height }} />
  );
}
