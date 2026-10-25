import { motion } from "framer-motion";
import { formatClock, type RoundConfig } from "@hc/shared";
import { roundName, t } from "../lib/strings";
import { Coin } from "../components/Layout";
import { Medal } from "../components/Juice";
import { Icon } from "../components/Icon";
import { SahayikaAvatar } from "../components/SahayikaAvatar";

/** Timer chip: a small ring plus the clock. Colour, icon and a pulse change at 5 min and 1 min (never colour alone). */
export function TimerChip({ remaining, limit, warn5, warn1 }: { remaining: number; limit: number; warn5: number; warn1: number }) {
  const frac = Math.max(0, Math.min(1, remaining / limit));
  const state = remaining <= warn1 ? "danger" : remaining <= warn5 ? "warn" : "ok";
  const color = state === "danger" ? "#F87171" : state === "warn" ? "#FBBF24" : "#EED9A4";
  const r = 11, c = 2 * Math.PI * r;
  return (
    <motion.div className={`inline-flex items-center gap-2 rounded-full border pl-1.5 pr-3 h-9 ${state === "danger" ? "border-red-400/60 bg-red-500/15" : "border-white/20 bg-white/10"}`}
      animate={state === "danger" ? { scale: [1, 1.04, 1] } : {}} transition={{ repeat: Infinity, duration: 1 }}
      role="timer" aria-label={t("common.timeLeft", { time: formatClock(remaining) })}>
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden>
        <circle cx="13" cy="13" r={r} fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="3" />
        <motion.circle cx="13" cy="13" r={r} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" transform="rotate(-90 13 13)"
          strokeDasharray={c} animate={{ strokeDashoffset: c * (1 - frac) }} transition={{ duration: 0.5 }} />
        <foreignObject x="7" y="7" width="12" height="12"><div style={{ color }} className="grid place-items-center w-3 h-3"><Icon name={state === "ok" ? "clock" : state === "warn" ? "hourglass" : "alert"} size={12} stroke={2.4} /></div></foreignObject>
      </svg>
      <span className="sr-only">{t("round.time")}</span>
      <span className="text-[17px] font-extrabold tnum leading-none" style={{ color: state === "ok" ? "#fff" : color }}>{formatClock(remaining)}</span>
    </motion.div>
  );
}

const pill = "inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 hover:bg-white/20 h-9 px-3 text-sm font-semibold text-white transition active:scale-95";

/**
 * Workbench bar (Anuvaad document workbench): back, document title, chance + status, clock, progress, credits, save state,
 * and only the three actions that matter: Ask Sahayak, Full Screen, Submit Translation.
 */
export function Hud({ round, chanceNo, maxChances, remaining, limit, warn5, warn1, progress, total, isTrial, creditCap, save, sample, onAsk, onSubmit, onBack, fullscreen, onFullscreen, submitting, confirming, partsLeft, readOnly }: {
  round: RoundConfig; chanceNo: number; maxChances: number; remaining: number; limit: number; warn5: number; warn1: number;
  progress: number; total: number; isTrial: boolean; creditCap: number; save: string; sample: boolean;
  onAsk(): void; onSubmit(): void; onBack(): void; fullscreen: boolean | null; onFullscreen(): void;
  submitting: boolean; confirming: boolean; partsLeft: number; readOnly: boolean;
}) {
  const segmented = total <= 30;
  const status = submitting ? t("round.submitting") : readOnly ? t("round.readOnly") : t("round.inProgress");
  return (
    <div className="bg-navy text-white border-b border-white/10 shadow-pop">
      <div className="w-full px-2 sm:px-4 py-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <button onClick={onBack} aria-label={t("round.back")} title={t("round.back")} className="w-9 h-9 rounded-full grid place-items-center border border-white/25 bg-white/10 hover:bg-white/20 active:scale-95 transition">
          <Icon name="chevronLeft" size={18} />
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <span className="hidden sm:block"><Medal k={round.key} size={30} /></span>
          <div className="leading-tight min-w-0">
            <div className="hidden sm:block text-[10px] font-bold uppercase tracking-[0.16em] text-gold-light">{round.levelLabel}{sample ? ` · ${t("round.reviewBuild")}` : ""}</div>
            <div className="text-base font-extrabold truncate">{roundName(round)}</div>
          </div>
        </div>
        <span className="ml-auto sm:ml-0 inline-flex items-center rounded-full border border-white/25 px-2.5 h-7 text-[12px] font-bold tnum" title={t("common.chanceOf", { n: chanceNo, max: maxChances })}>{t("common.chanceOf", { n: chanceNo, max: maxChances })}</span>
        <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-primary/20 border border-primary/50 px-2.5 h-7 text-[12px] font-bold text-orange-100" aria-live="polite">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse motion-reduce:animate-none" aria-hidden />{status}
        </span>
        <TimerChip remaining={remaining} limit={limit} warn5={warn5} warn1={warn1} />
        <div className="flex-1 min-w-[7rem] sm:max-w-xs max-sm:order-last max-sm:basis-full">
          <div className="flex justify-between items-baseline text-[10px] font-bold uppercase tracking-[0.16em] text-blue-100/70"><span>{t("round.progress")}</span>
            <span className="text-white normal-case tracking-normal text-[13px] font-bold tnum">{isTrial ? t("round.sentencesDone", { done: progress, total }) : t("round.paragraphsDone", { done: progress, total })}</span></div>
          {segmented ? (
            <div className="mt-1 flex gap-[3px]" aria-hidden>
              {Array.from({ length: total }, (_, i) => (
                <motion.span key={i} className={`h-1.5 flex-1 rounded-sm ${i < progress ? "bg-success" : "bg-white/15"}`} animate={i === progress - 1 ? { scaleY: [1, 1.8, 1] } : {}} />
              ))}
            </div>
          ) : (
            <div className="mt-1 h-1.5 rounded-sm bg-white/15 overflow-hidden" aria-hidden>
              <motion.div className="h-full bg-gradient-to-r from-success to-emerald-400" animate={{ width: `${(progress / (total || 1)) * 100}%` }} transition={{ type: "spring", stiffness: 90, damping: 20 }} />
            </div>
          )}
        </div>
        <div className="hidden lg:flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-2.5 h-7" title={t("common.creditsUpTo", { n: creditCap })}>
          <Coin size={14} /><span className="text-[12px] font-bold text-gold-light"><span className="hidden 2xl:inline">{t("common.creditsUpTo", { n: creditCap })}</span><span className="2xl:hidden">{t("round.creditsShort", { n: creditCap })}</span></span>
        </div>
        <span className={`inline-flex items-center gap-1 text-xs font-bold rounded-full px-2 h-7 ${save === "offline" ? "bg-amber-400/20 text-amber-200" : "bg-success/20 text-emerald-200"}`} aria-live="polite">
          <Icon name={save === "saving" ? "refresh" : save === "offline" ? "alert" : "check"} size={13} />
          <span className="max-sm:sr-only">{save === "saving" ? t("round.saving") : save === "offline" ? t("round.offline") : t("round.saved")}</span>
        </span>
        <span className="hidden sm:inline text-blue-100/80" title={t("round.copyPasteLocked")} aria-label={t("common.copyPasteOffBadge")} role="img"><Icon name="lock" size={16} /></span>
        <div className="flex items-center gap-2 ml-auto">
          <button onClick={onAsk} aria-label={t("round.askSahayak")} title={t("round.askSahayak")} className={`${pill} !pl-1`}>
            <SahayikaAvatar size={26} ring={false} /><span className="hidden md:inline">{t("round.askSahayak")}</span>
          </button>
          {fullscreen !== null && (
            <button onClick={onFullscreen} aria-pressed={fullscreen} aria-label={fullscreen ? t("round.exitFullScreen") : t("round.fullScreen")} title={fullscreen ? t("round.exitFullScreen") : t("round.fullScreen")} className={pill}>
              <Icon name="window" size={16} /><span className="hidden 2xl:inline">{fullscreen ? t("round.exitFullScreen") : t("round.fullScreen")}</span>
            </button>
          )}
          {confirming && <span className="text-sm font-semibold text-amber-200 animate-pop">{t("round.partsLeft", { n: partsLeft })}</span>}
          <button onClick={onSubmit} disabled={readOnly || submitting} aria-label={submitting || confirming ? undefined : t("round.submit")} className={`btn-primary !rounded-full py-2 px-4 sm:px-5 active:scale-95 transition-transform ${confirming ? "!bg-timer-text animate-wiggle" : ""}`}>
            {submitting ? t("round.submitting") : confirming ? t("round.confirmSubmit") : <><span className="sm:hidden">{t("round.submitShort")}</span><span className="hidden sm:inline">{t("round.submit")}</span></>}
          </button>
        </div>
      </div>
    </div>
  );
}
