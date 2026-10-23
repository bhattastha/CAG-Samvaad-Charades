import { motion } from "framer-motion";
import { formatClock, type RoundConfig } from "@hc/shared";
import { roundName, t } from "../lib/strings";
import { Coin } from "../components/Layout";
import { Medal } from "../components/Juice";
import { Icon } from "../components/Icon";

/** Circular timer: glanceable; colour + icon + pulse change at 5 min and 1 min (never colour alone). */
export function TimerRing({ remaining, limit, warn5, warn1 }: { remaining: number; limit: number; warn5: number; warn1: number }) {
  const frac = Math.max(0, Math.min(1, remaining / limit));
  const state = remaining <= warn1 ? "danger" : remaining <= warn5 ? "warn" : "ok";
  const color = state === "danger" ? "#F87171" : state === "warn" ? "#FBBF24" : "#E9D7A6";
  const r = 17, c = 2 * Math.PI * r;
  return (
    <motion.div className={`flex items-center gap-2 rounded-ui border pl-1 pr-3 py-1 ${state === "danger" ? "border-red-400/60 bg-red-500/15" : "border-white/15 bg-white/[0.06]"}`}
      animate={state === "danger" ? { scale: [1, 1.04, 1] } : {}} transition={{ repeat: Infinity, duration: 1 }}
      role="timer" aria-label={t("common.timeLeft", { time: formatClock(remaining) })}>
      <svg width="42" height="42" viewBox="0 0 42 42" aria-hidden>
        <circle cx="21" cy="21" r={r} fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="4" />
        <motion.circle cx="21" cy="21" r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" transform="rotate(-90 21 21)"
          strokeDasharray={c} animate={{ strokeDashoffset: c * (1 - frac) }} transition={{ duration: 0.5 }} />
        <foreignObject x="11" y="11" width="20" height="20"><div style={{ color }} className="grid place-items-center w-5 h-5"><Icon name={state === "ok" ? "clock" : state === "warn" ? "hourglass" : "alert"} size={18} /></div></foreignObject>
      </svg>
      <div className="leading-tight">
        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-100/70">{t("round.time")}</div>
        <div className="text-xl font-extrabold tnum" style={{ color: state === "ok" ? "#fff" : color }}>{formatClock(remaining)}</div>
      </div>
    </motion.div>
  );
}

/** In-round HUD: level, chance, clock, progress, credits at stake, save state. Dark, so the page stays the focus. */
export function Hud({ round, chanceNo, maxChances, remaining, limit, warn5, warn1, progress, total, isTrial, creditCap, save, sample }: {
  round: RoundConfig; chanceNo: number; maxChances: number; remaining: number; limit: number; warn5: number; warn1: number;
  progress: number; total: number; isTrial: boolean; creditCap: number; save: string; sample: boolean;
}) {
  const segmented = total <= 30;
  return (
    <div className="bg-navy text-white hud-grid border-b border-white/10 shadow-pop">
      <div className="mx-auto w-full max-w-[1500px] px-3 sm:px-6 py-2 flex flex-wrap items-center gap-x-5 gap-y-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <Medal k={round.key} size={38} />
          <div className="leading-tight min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold-light">{round.levelLabel}{sample ? ` · ${t("round.reviewBuild")}` : ""}</div>
            <div className="text-lg font-extrabold truncate">{roundName(round)}</div>
          </div>
        </div>
        <div className="flex items-center gap-1" aria-label={t("common.chanceOf", { n: chanceNo, max: maxChances })} title={t("common.chanceOf", { n: chanceNo, max: maxChances })}>
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-100/70 mr-1">{t("round.chance")}</span>
          {Array.from({ length: maxChances }, (_, i) => (
            <span key={i} className={`w-6 h-6 rounded-md grid place-items-center text-[11px] font-bold border ${i + 1 === chanceNo ? "bg-primary border-primary text-white" : i + 1 < chanceNo ? "bg-white/10 border-white/10 text-blue-100/60" : "border-white/25 text-blue-100/70"}`}>{i + 1}</span>
          ))}
        </div>
        <TimerRing remaining={remaining} limit={limit} warn5={warn5} warn1={warn1} />
        <div className="flex-1 min-w-[12rem]">
          <div className="flex justify-between text-[10px] font-bold uppercase tracking-[0.16em] text-blue-100/70"><span>{t("round.progress")}</span>
            <span className="text-white normal-case tracking-normal text-sm font-bold tnum">{isTrial ? t("round.sentencesDone", { done: progress, total }) : t("round.paragraphsDone", { done: progress, total })}</span></div>
          {segmented ? (
            <div className="mt-1.5 flex gap-[3px]" aria-hidden>
              {Array.from({ length: total }, (_, i) => (
                <motion.span key={i} className={`h-2 flex-1 rounded-sm ${i < progress ? "bg-success" : "bg-white/15"}`} animate={i === progress - 1 ? { scaleY: [1, 1.8, 1] } : {}} />
              ))}
            </div>
          ) : (
            <div className="mt-1.5 h-2 rounded-sm bg-white/15 overflow-hidden" aria-hidden>
              <motion.div className="h-full bg-gradient-to-r from-success to-emerald-400" animate={{ width: `${(progress / (total || 1)) * 100}%` }} transition={{ type: "spring", stiffness: 90, damping: 20 }} />
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 rounded-ui border border-gold/40 bg-gold/10 px-2.5 py-1.5" title={t("common.creditsUpTo", { n: creditCap })}>
          <Coin size={16} /><span className="text-sm font-bold text-gold-light">{t("common.creditsUpTo", { n: creditCap })}</span>
        </div>
        <span className={`inline-flex items-center gap-1 text-xs font-bold rounded-md px-2 py-1 ${save === "offline" ? "bg-amber-400/20 text-amber-200" : "bg-success/20 text-emerald-200"}`} aria-live="polite">
          <Icon name={save === "saving" ? "refresh" : save === "offline" ? "alert" : "check"} size={13} />
          {save === "saving" ? t("round.saving") : save === "offline" ? t("round.offline") : t("round.saved")}
        </span>
      </div>
    </div>
  );
}
