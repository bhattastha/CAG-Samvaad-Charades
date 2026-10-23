import { AnimatePresence, motion } from "framer-motion";
import { Link } from "react-router-dom";
import cagLogo from "@assets/brand/cag-logo.png";
import bhashiniLogo from "@assets/brand/bhashini-logo.png";
import { useConfig, useProgress } from "../lib/queries";
import { useEffect, useState } from "react";
import { useToasts } from "../lib/store";
import { t } from "../lib/strings";
import { sfx } from "../lib/sfx";
import { useSettingsOpen } from "./Settings";

export function Stars({ n, total = 5, size = 28, animate = false }: { n: number; total?: number; size?: number; animate?: boolean }) {
  return (
    <div className="flex gap-1" role="img" aria-label={`${n} / ${total} ${t("common.stars")}`}>
      {Array.from({ length: total }, (_, i) => (
        <motion.svg key={i} width={size} height={size} viewBox="0 0 24 24" aria-hidden
          initial={animate && i < n ? { scale: 0, rotate: -90 } : false} animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 12, delay: animate ? 0.4 + i * 0.18 : 0 }}
          onAnimationStart={() => { if (animate && i < n) setTimeout(() => sfx("star"), 400 + i * 180); }}>
          <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z" fill={i < n ? "#F59E0B" : "#E5E7EB"} stroke={i < n ? "#D97706" : "#D1D5DB"} strokeWidth="1" />
          {i < n && <path d="M12 5.5l1.6 3.4" stroke="#FEF3C7" strokeWidth="1.4" strokeLinecap="round" />}
        </motion.svg>
      ))}
    </div>
  );
}

export function Coin({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="10" fill="#F59E0B" /><circle cx="12" cy="12" r="7.2" fill="#FBBF24" stroke="#D97706" strokeWidth="1" />
      <text x="12" y="16" textAnchor="middle" fontSize="10" fontWeight="700" fill="#92400E">₵</text>
    </svg>
  );
}

/** The page language (the BHASHINI translation plugin may change <html lang>). */
function useHtmlLang() {
  const [lang, setLang] = useState(document.documentElement.lang || "en");
  useEffect(() => {
    const o = new MutationObserver(() => setLang(document.documentElement.lang || "en"));
    o.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    return () => o.disconnect();
  }, []);
  return lang;
}

/** "Samvaad Charades" is a brand: never translated, only shown in its localised spelling for the page language. */
export function BrandName({ split = false, className = "" }: { split?: boolean; className?: string }) {
  const { data: cfg } = useConfig();
  const lang = useHtmlLang().slice(0, 2);
  const name = cfg?.brand?.localized?.[lang] ?? cfg?.brand?.name ?? t("common.gameName");
  const [first, ...rest] = name.split(" ");
  return (
    <span translate="no" className={`notranslate ${className}`} data-brand>
      {split ? <><span className="text-navy">{first}</span> <span className="text-primary">{rest.join(" ")}</span></> : name}
    </span>
  );
}

/** HUD credits meter: glanceable progress toward 50, gold = reward. */
export function CreditMeter({ value, max = 50, compact = false }: { value: number; max?: number; compact?: boolean }) {
  return (
    <div className={`flex items-center gap-2 rounded-full bg-amber-50 border border-amber-200 ${compact ? "px-2 py-1" : "px-3 py-1.5"}`} title={`${value} / ${max} ${t("common.credits")}`}>
      <Coin size={compact ? 16 : 20} />
      <div className="hidden sm:block w-20 h-2 rounded-full bg-amber-100 overflow-hidden">
        <motion.div className="h-full bg-gradient-to-r from-amber-400 to-primary" initial={{ width: 0 }} animate={{ width: `${(value / max) * 100}%` }} transition={{ type: "spring", stiffness: 80, damping: 18 }} />
      </div>
      <span className="font-extrabold text-amber-800 tabular-nums text-sm">{value}<span className="font-semibold text-amber-700/70">/{max}</span></span>
    </div>
  );
}

/** Global header (§7): CAG left, title centre, BHASHINI right, plus the game HUD and settings. */
export function Header({ compact = false, hud = true }: { compact?: boolean; hud?: boolean }) {
  const { data } = useProgress();
  const openSettings = useSettingsOpen((s) => s.set);
  const s = data?.summary;
  return (
    <header className="sticky top-0 z-30 bg-white/85 backdrop-blur border-b border-orange-100">
      <div className={`mx-auto max-w-7xl px-3 sm:px-6 flex items-center gap-2 sm:gap-3 ${compact ? "h-14" : "h-16 sm:h-[72px]"}`}>
        <img src={cagLogo} alt="CAG" className={`${compact ? "h-9" : "h-10 sm:h-12"} w-auto rounded-md border border-gray-100 bg-white p-0.5`} />
        <Link to={data?.registered ? "/journey" : "/"} className="flex-1 text-center leading-tight min-w-0">
          <div className={`${compact ? "text-[0.95rem] sm:text-lg" : "text-[0.95rem] sm:text-2xl"} font-extrabold whitespace-nowrap`}>
            <BrandName split />
          </div>
          <div className="en text-[10px] sm:text-[11px] tracking-[0.3em] text-muted">{t("common.brandLine")}</div>
        </Link>
        {hud && s && (
          <div className="flex items-center gap-2">
            <CreditMeter value={s.totalCredits} compact={compact} />
            <span className="hidden md:inline-flex chip-plain"><Stars n={s.stars} total={s.starsTotal} size={15} /></span>
          </div>
        )}
        <motion.button whileTap={{ scale: 0.88, rotate: 45 }} onClick={() => { sfx("tap"); openSettings(true); }}
          className="rounded-full border border-gray-200 bg-white w-10 h-10 grid place-items-center text-lg hover:bg-gray-50" aria-label={t("common.settings")} title={t("common.settings")}>⚙️</motion.button>
        <img src={bhashiniLogo} alt="BHASHINI" className={`${compact ? "h-9" : "h-10 sm:h-12"} w-auto rounded-md border border-gray-100 bg-white p-0.5 hidden xs:block sm:block`} />
      </div>
    </header>
  );
}

export function PageTitle({ hi, en, right, kicker }: { hi: string; en?: string; right?: React.ReactNode; kicker?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ type: "spring", stiffness: 200, damping: 22 }}>
        {kicker && <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-royal mb-1">{kicker}</div>}
        <h1 className="text-3xl sm:text-[2.6rem] font-extrabold text-primary leading-tight">{hi}</h1>
        {en && <div className="text-base sm:text-lg font-semibold text-muted mt-0.5">{en}</div>}
      </motion.div>
      {right && <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-wrap items-center gap-2">{right}</motion.div>}
    </div>
  );
}

export function Page({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return <main className={`relative mx-auto ${wide ? "max-w-[1400px]" : "max-w-7xl"} px-4 sm:px-6 py-6 sm:py-8`}>{children}</main>;
}

export function Toasts() {
  const items = useToasts((s) => s.items);
  return (
    <div className="fixed z-[95] left-1/2 -translate-x-1/2 top-20 flex flex-col items-center gap-2 pointer-events-none" aria-live="polite">
      <AnimatePresence>
        {items.map((x) => (
          <motion.div key={x.id} initial={{ y: -30, opacity: 0, scale: 0.9 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: -20, opacity: 0 }}
            className={`rounded-xl px-4 py-2.5 text-[1rem] font-semibold shadow-pop flex items-center gap-2 ${x.tone === "warn" ? "bg-navy text-white" : x.tone === "good" ? "bg-success text-white" : "bg-royal text-white"}`}>
            <span aria-hidden>{x.tone === "warn" ? "🔒" : x.tone === "good" ? "✓" : "ℹ"}</span> {x.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function Confetti({ run }: { run: boolean }) {
  if (!run) return null;
  const colors = ["#E8590C", "#2563EB", "#F59E0B", "#16A34A", "#FDBA74", "#93C5FD"];
  return (
    <div className="pointer-events-none fixed inset-0 z-[70] overflow-hidden" aria-hidden>
      <style>{`@keyframes hcfall{0%{transform:translateY(-10vh) rotate(0)}100%{transform:translateY(110vh) rotate(720deg)}}`}</style>
      {Array.from({ length: 90 }, (_, i) => (
        <span key={i} style={{
          position: "absolute", left: `${(i * 37) % 100}%`, top: 0, width: 8 + (i % 4) * 2, height: 12 + (i % 3) * 3,
          background: colors[i % colors.length], borderRadius: i % 3 ? 2 : 99,
          animation: `hcfall ${2.6 + (i % 7) * 0.35}s ${(i % 10) * 0.12}s cubic-bezier(.3,.6,.4,1) forwards`,
        }} />
      ))}
    </div>
  );
}

/** Loading filler: a spinning "अ ↔ A" coin instead of a bare spinner. */
export function Spinner() {
  return (
    <div className="grid place-items-center py-24 text-muted gap-4">
      <motion.div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-amber-400 text-white grid place-items-center text-3xl font-extrabold shadow-glow"
        animate={{ rotateY: [0, 180, 360] }} transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}>
        अ
      </motion.div>
      <div className="font-semibold">{t("common.loading")}</div>
    </div>
  );
}

export function ProgressBar({ value, tone = "orange", striped = false, label, checkpoints }: { value: number; tone?: "orange" | "blue" | "green" | "soft" | "gold"; striped?: boolean; label?: string; checkpoints?: number }) {
  const c = { orange: "bg-primary", blue: "bg-royal-bright", green: "bg-success", soft: "bg-orange-300", gold: "bg-gradient-to-r from-amber-400 to-primary" }[tone];
  return (
    <div className="relative h-3 w-full rounded-full bg-gray-100 overflow-hidden" role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <motion.div className={`h-full rounded-full ${c} ${striped ? "stripe animate-shine" : ""}`} initial={{ width: 0 }} animate={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} transition={{ type: "spring", stiffness: 90, damping: 20 }} />
      {checkpoints && Array.from({ length: checkpoints - 1 }, (_, i) => (
        <span key={i} className="absolute top-0 bottom-0 w-[2px] bg-white/80" style={{ left: `${((i + 1) / checkpoints) * 100}%` }} aria-hidden />
      ))}
    </div>
  );
}
