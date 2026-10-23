import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform, type HTMLMotionProps } from "framer-motion";
import { create } from "zustand";
import { sfx, type Sfx } from "../lib/sfx";
import { t } from "../lib/strings";

const canHover = typeof window !== "undefined" && window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;

/** Springy button: compresses on press, lifts on hover (mouse only, so taps never miss), clicks with sound + haptic. */
export const GameButton = forwardRef<HTMLButtonElement, HTMLMotionProps<"button"> & { sound?: Sfx | null; variant?: "primary" | "blue" | "ghost" | "light" | "plain" }>(
  function GameButton({ sound = "tap", variant = "primary", className = "", onClick, children, ...rest }, ref) {
    const base = variant === "plain" ? "" : variant === "primary" ? "btn-primary" : variant === "blue" ? "btn-blue" : variant === "ghost" ? "btn-ghost" : "btn bg-white/90 text-navy border-2 border-white hover:bg-white";
    return (
      <motion.button
        ref={ref}
        whileHover={rest.disabled || !canHover ? undefined : { y: -2, scale: 1.02 }}
        whileTap={rest.disabled ? undefined : { scale: 0.93, y: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 18 }}
        className={`${base} ${className}`}
        onClick={(e) => { if (sound) sfx(sound); onClick?.(e); }}
        {...rest}
      >
        {children as React.ReactNode}
      </motion.button>
    );
  },
);

// ---------------- floating text (spatial feedback near the action) ----------------

interface Float { id: number; x: number; y: number; text: string; tone: "good" | "gold" | "warn" }
const useFloats = create<{ items: Float[] }>(() => ({ items: [] }));
let fid = 0;
export function floatText(text: string, at: { x: number; y: number } | DOMRect | null, tone: Float["tone"] = "good") {
  const p = at ? ("width" in at ? { x: at.left + at.width / 2, y: at.top } : at) : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const id = ++fid;
  useFloats.setState((s) => ({ items: [...s.items, { id, x: p.x, y: p.y, text, tone }] }));
  setTimeout(() => useFloats.setState((s) => ({ items: s.items.filter((f) => f.id !== id) })), 1400);
}
export function FloatLayer() {
  const items = useFloats((s) => s.items);
  return (
    <div className="pointer-events-none fixed inset-0 z-[96] overflow-hidden" aria-hidden>
      <AnimatePresence>
        {items.map((f) => (
          <motion.div key={f.id} initial={{ opacity: 0, y: 0, scale: 0.6 }} animate={{ opacity: 1, y: -60, scale: 1 }} exit={{ opacity: 0, y: -90 }}
            transition={{ type: "spring", stiffness: 260, damping: 16 }}
            className={`absolute -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 text-sm font-extrabold shadow-pop ${f.tone === "good" ? "bg-success text-white" : f.tone === "gold" ? "bg-gold text-navy" : "bg-timer-text text-white"}`}
            style={{ left: f.x, top: f.y }}>
            {f.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ---------------- particle burst ----------------

const BURST_COLORS = ["#E8590C", "#2563EB", "#F59E0B", "#16A34A", "#FDBA74", "#93C5FD", "#FDE047"];
export function Burst({ fire, count = 28, spread = 220, origin }: { fire: number; count?: number; spread?: number; origin?: { x: number; y: number } }) {
  const parts = useMemo(() => Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2 + Math.random() * 0.4;
    const d = spread * (0.45 + Math.random() * 0.55);
    return { dx: Math.cos(a) * d, dy: Math.sin(a) * d - 40, c: BURST_COLORS[i % BURST_COLORS.length], s: 6 + (i % 4) * 2, r: Math.random() * 360 };
  }), [fire, count, spread]);
  if (!fire) return null;
  return (
    <div key={fire} className="pointer-events-none fixed inset-0 z-[97] overflow-hidden" aria-hidden>
      {parts.map((p, i) => (
        <motion.span key={i} initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }} animate={{ x: p.dx, y: p.dy + 120, opacity: 0, rotate: p.r, scale: 0.6 }}
          transition={{ duration: 1.1 + (i % 5) * 0.08, ease: [0.2, 0.8, 0.4, 1] }}
          className="absolute rounded-sm" style={{ left: origin?.x ?? "50%", top: origin?.y ?? "45%", width: p.s, height: p.s * 1.4, background: p.c }} />
      ))}
    </div>
  );
}

// ---------------- numbers that count up ----------------

export function CountUp({ to, decimals = 0, duration = 1.2, onTick }: { to: number; decimals?: number; duration?: number; onTick?: () => void }) {
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { duration: duration * 1000, bounce: 0 });
  const text = useTransform(spring, (v) => v.toFixed(decimals));
  const last = useRef(0);
  useEffect(() => { mv.set(to); }, [to, mv]);
  useEffect(() => spring.on("change", (v) => { if (onTick && Math.floor(v / 5) !== last.current) { last.current = Math.floor(v / 5); onTick(); } }), [spring, onTick]);
  return <motion.span>{text}</motion.span>;
}

// ---------------- 3-2-1-GO ----------------

export function Countdown({ onDone }: { onDone(): void }) {
  const [n, setN] = useState(3);
  useEffect(() => {
    sfx(n > 0 ? "tick" : "go");
    if (n < 0) { onDone(); return; }
    const tm = setTimeout(() => setN(n - 1), n === 0 ? 650 : 800);
    return () => clearTimeout(tm);
  }, [n]);
  return (
    <div className="fixed inset-0 z-[99] grid place-items-center bg-navy/70 backdrop-blur-sm" role="status" aria-live="assertive">
      <AnimatePresence mode="popLayout">
        {n >= 0 && (
          <motion.div key={n} initial={{ scale: 2.4, opacity: 0, rotate: -8 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} exit={{ scale: 0.4, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 14 }}
            className={`font-extrabold drop-shadow-[0_8px_30px_rgba(232,89,12,.6)] ${n === 0 ? "text-[7rem] text-gold" : "text-[10rem] text-white"}`}>
            {n === 0 ? t("preRound.countdownGo") : n}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="absolute bottom-[22%] text-white/80 text-lg font-semibold">{t("preRound.getReady")}</div>
    </div>
  );
}

// ---------------- stamp (mission complete / time's up) ----------------

export function Stamp({ text, tone = "good" }: { text: string; tone?: "good" | "warn" }) {
  return (
    <motion.div initial={{ scale: 3, opacity: 0, rotate: -18 }} animate={{ scale: 1, opacity: 1, rotate: -6 }} transition={{ type: "spring", stiffness: 380, damping: 15 }}
      className={`inline-block rounded-2xl border-[6px] px-8 py-4 text-5xl sm:text-6xl font-extrabold uppercase tracking-wide ${tone === "good" ? "border-success text-success bg-white/90" : "border-timer-text text-timer-text bg-white/90"}`}>
      {text}
    </motion.div>
  );
}

// ---------------- title medal ----------------

const MEDAL: Record<string, [string, string, string]> = {
  trial: ["#FDBA74", "#E8590C", "🌱"], primary: ["#93C5FD", "#2563EB", "📄"], secondary: ["#86EFAC", "#16A34A", "📊"], pro: ["#FDE047", "#D97706", "🏆"],
};
export function Medal({ k, size = 72, locked = false, shine = false }: { k: string; size?: number; locked?: boolean; shine?: boolean }) {
  const [a, b, icon] = MEDAL[k] ?? MEDAL.trial;
  return (
    <div className={`relative grid place-items-center ${locked ? "grayscale opacity-50" : ""}`} style={{ width: size, height: size }} aria-hidden>
      <svg viewBox="0 0 64 64" width={size} height={size} className="absolute inset-0">
        <defs><linearGradient id={`m-${k}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={a} /><stop offset="1" stopColor={b} /></linearGradient></defs>
        <path d="M32 2l7 6 9-1 3 9 8 5-3 9 3 9-8 5-3 9-9-1-7 6-7-6-9 1-3-9-8-5 3-9-3-9 8-5 3-9 9 1z" fill={`url(#m-${k})`} stroke="#fff" strokeWidth="2" />
        <circle cx="32" cy="32" r="17" fill="#fff" opacity=".92" />
      </svg>
      <span className="relative" style={{ fontSize: size * 0.34 }}>{locked ? "🔒" : icon}</span>
      {shine && !locked && <span className="absolute inset-0 rounded-full animate-shine" style={{ background: "linear-gradient(110deg,transparent 40%,rgba(255,255,255,.7) 50%,transparent 60%)", backgroundSize: "200% 100%" }} />}
    </div>
  );
}

// ---------------- ambient background: drifting letters ----------------

const GLYPHS = ["अ", "A", "क", "B", "ह", "ि", "॥", "C", "न", "।", "श", "R", "ज्ञ", "T", "प्र", "E"];
export function Ambient({ density = 14 }: { density?: number }) {
  const items = useMemo(() => Array.from({ length: density }, (_, i) => ({
    g: GLYPHS[i % GLYPHS.length], left: (i * 61) % 100, size: 18 + ((i * 7) % 26), dur: 18 + (i % 6) * 4, delay: -(i * 2.3), blue: i % 3 === 0,
  })), [density]);
  return (
    <div className="pointer-events-none fixed inset-0 -z-0 overflow-hidden hc-ambient" aria-hidden>
      {items.map((x, i) => (
        <motion.span key={i} className={`absolute font-bold ${x.blue ? "text-royal-bright/10" : "text-primary/10"}`} style={{ left: `${x.left}%`, fontSize: x.size }}
          initial={{ y: "105vh" }} animate={{ y: "-10vh", rotate: [0, 12, -8, 0] }} transition={{ duration: x.dur, delay: x.delay, repeat: Infinity, ease: "linear" }}>
          {x.g}
        </motion.span>
      ))}
    </div>
  );
}
