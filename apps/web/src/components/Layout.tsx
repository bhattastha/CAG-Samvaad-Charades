import { Link } from "react-router-dom";
import cagLogo from "@assets/brand/cag-logo.png";
import bhashiniLogo from "@assets/brand/bhashini-logo.png";
import { useProgress } from "../lib/queries";
import { usePrefs, useToasts } from "../lib/store";
import { t } from "../lib/strings";

export function Stars({ n, total = 5, size = 28, animate = false }: { n: number; total?: number; size?: number; animate?: boolean }) {
  return (
    <div className="flex gap-1" aria-label={`${n} / ${total} ${t("ui.stars")}`}>
      {Array.from({ length: total }, (_, i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" className={animate && i < n ? "animate-pop" : ""} style={{ animationDelay: `${i * 140}ms` }} aria-hidden="true">
          <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z" fill={i < n ? "#F59E0B" : "#E5E7EB"} stroke={i < n ? "#D97706" : "#D1D5DB"} strokeWidth="1" />
        </svg>
      ))}
    </div>
  );
}

export function Coin({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#F59E0B" /><circle cx="12" cy="12" r="7.2" fill="#FBBF24" stroke="#D97706" strokeWidth="1" />
      <text x="12" y="16" textAnchor="middle" fontSize="10" fontWeight="700" fill="#92400E">₵</text>
    </svg>
  );
}

function MuteToggle() {
  const { muted, setMuted } = usePrefs();
  return (
    <button
      onClick={() => setMuted(!muted)}
      className="rounded-full border border-gray-200 bg-white w-10 h-10 grid place-items-center text-lg hover:bg-gray-50"
      aria-label={muted ? t("common.unmute") : t("common.mute")}
      title={muted ? t("common.unmute") : t("common.mute")}
    >
      {muted ? "🔇" : "🔊"}
    </button>
  );
}

/** Global header (§7): CAG left, title centre, BHASHINI right; plus a small game HUD. */
export function Header({ compact = false }: { compact?: boolean }) {
  const { data } = useProgress();
  const s = data?.summary;
  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-orange-100">
      <div className={`mx-auto max-w-7xl px-3 sm:px-6 flex items-center gap-3 ${compact ? "h-14" : "h-[72px]"}`}>
        <img src={cagLogo} alt="CAG" className={`${compact ? "h-9" : "h-12"} w-auto rounded-md border border-gray-100 bg-white p-0.5`} />
        <Link to="/" className="flex-1 text-center leading-tight">
          <div className={`${compact ? "text-lg" : "text-xl sm:text-2xl"} font-bold text-navy`}>{t("title.heading")}</div>
          <div className="en text-[11px] tracking-[0.3em] text-muted">{t("common.brandLine")}</div>
        </Link>
        {s && (
          <div className="hidden sm:flex items-center gap-2">
            <span className="chip-credit"><Coin size={18} />{s.totalCredits} / 50</span>
            <span className="chip-plain"><Stars n={s.stars} total={s.starsTotal} size={16} /></span>
          </div>
        )}
        <MuteToggle />
        <img src={bhashiniLogo} alt="BHASHINI" className={`${compact ? "h-9" : "h-12"} w-auto rounded-md border border-gray-100 bg-white p-0.5`} />
      </div>
    </header>
  );
}

export function PageTitle({ hi, en, right }: { hi: string; en: string; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-5 animate-rise">
      <h1 className="text-3xl sm:text-[40px] font-bold text-primary leading-tight">
        {hi} <span className="en align-middle text-base sm:text-lg italic font-semibold text-muted">{en}</span>
      </h1>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </div>
  );
}

export function Page({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return <main className={`mx-auto ${wide ? "max-w-[1400px]" : "max-w-7xl"} px-4 sm:px-6 py-6 sm:py-8`}>{children}</main>;
}

export function Toasts() {
  const items = useToasts((s) => s.items);
  return (
    <div className="fixed z-[80] left-1/2 -translate-x-1/2 bottom-28 flex flex-col items-center gap-2 pointer-events-none" aria-live="polite">
      {items.map((x) => (
        <div key={x.id} className={`animate-pop rounded-xl px-4 py-2.5 text-[16px] font-semibold shadow-pop flex items-center gap-2 ${x.tone === "warn" ? "bg-navy text-white" : x.tone === "good" ? "bg-success text-white" : "bg-royal text-white"}`}>
          {x.tone === "warn" ? "🔒" : x.tone === "good" ? "✓" : "ℹ"} {x.text}
        </div>
      ))}
    </div>
  );
}

export function Confetti({ run }: { run: boolean }) {
  if (!run) return null;
  const colors = ["#E8590C", "#2563EB", "#F59E0B", "#16A34A", "#FDBA74", "#93C5FD"];
  return (
    <div className="pointer-events-none fixed inset-0 z-[70] overflow-hidden" aria-hidden="true">
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

export function Spinner() {
  return (
    <div className="grid place-items-center py-24 text-muted gap-3">
      <div className="w-12 h-12 rounded-full border-4 border-orange-200 border-t-primary animate-spin" />
      <div>{t("ui.loading")}</div>
    </div>
  );
}

export function ProgressBar({ value, tone = "orange", striped = false, label }: { value: number; tone?: "orange" | "blue" | "green" | "soft"; striped?: boolean; label?: string }) {
  const c = { orange: "bg-primary", blue: "bg-royal-bright", green: "bg-success", soft: "bg-orange-300" }[tone];
  return (
    <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden" role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={`h-full rounded-full ${c} ${striped ? "stripe animate-shine" : ""} transition-[width] duration-700`} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  );
}
