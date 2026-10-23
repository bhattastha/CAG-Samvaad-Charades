import { motion } from "framer-motion";
import { formatClock, type RoundConfig } from "@hc/shared";
import { roundName, t } from "../lib/strings";
import { Coin } from "../components/Layout";
import { Medal } from "../components/Juice";

/** Circular timer: glanceable; colour + icon + pulse change at 5 min and 1 min (never colour alone). */
export function TimerRing({ remaining, limit, warn5, warn1 }: { remaining: number; limit: number; warn5: number; warn1: number }) {
  const frac = Math.max(0, Math.min(1, remaining / limit));
  const state = remaining <= warn1 ? "danger" : remaining <= warn5 ? "warn" : "ok";
  const color = state === "danger" ? "#B42318" : state === "warn" ? "#D97706" : "#2563EB";
  const r = 22, c = 2 * Math.PI * r;
  return (
    <motion.div className="flex items-center gap-2 rounded-full bg-white border border-gray-200 pl-1 pr-3 py-1 shadow-sm"
      animate={state === "danger" ? { scale: [1, 1.06, 1] } : {}} transition={{ repeat: Infinity, duration: 1 }}
      role="timer" aria-label={t("common.timeLeft", { time: formatClock(remaining) })}>
      <svg width="52" height="52" viewBox="0 0 52 52" aria-hidden>
        <circle cx="26" cy="26" r={r} fill="none" stroke="#EEF2F7" strokeWidth="6" />
        <motion.circle cx="26" cy="26" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" transform="rotate(-90 26 26)"
          strokeDasharray={c} animate={{ strokeDashoffset: c * (1 - frac) }} transition={{ duration: 0.5 }} />
        <text x="26" y="31" textAnchor="middle" fontSize="15">{state === "danger" ? "⚠" : state === "warn" ? "⏳" : "⏱"}</text>
      </svg>
      <div className="leading-tight">
        <div className="text-[10px] font-extrabold uppercase tracking-widest text-muted">{t("round.time")}</div>
        <div className="text-xl font-extrabold tabular-nums" style={{ color }}>{formatClock(remaining)}</div>
      </div>
    </motion.div>
  );
}

export function Hud({ round, chanceNo, maxChances, remaining, limit, warn5, warn1, progress, total, isTrial, creditCap, save, sample }: {
  round: RoundConfig; chanceNo: number; maxChances: number; remaining: number; limit: number; warn5: number; warn1: number;
  progress: number; total: number; isTrial: boolean; creditCap: number; save: string; sample: boolean;
}) {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-3 sm:px-6 pt-3">
      <div className="rounded-2xl bg-white/90 backdrop-blur border border-orange-100 shadow-card px-3 sm:px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <Medal k={round.key} size={46} />
          <div className="leading-tight min-w-0">
            <div className="text-[10px] font-extrabold uppercase tracking-widest text-royal">{round.levelLabel}{sample ? ` · ${t("registration.sampleContent")}` : ""}</div>
            <div className="text-lg sm:text-xl font-extrabold text-primary truncate">{roundName(round)}</div>
          </div>
        </div>
        <div className="flex items-center gap-1" aria-label={t("common.chanceOf", { n: chanceNo, max: maxChances })} title={t("common.chanceOf", { n: chanceNo, max: maxChances })}>
          {Array.from({ length: maxChances }, (_, i) => (
            <span key={i} className={`w-6 h-6 rounded-full grid place-items-center text-[11px] font-extrabold border-2 ${i + 1 === chanceNo ? "bg-primary border-primary text-white" : i + 1 < chanceNo ? "bg-gray-200 border-gray-300 text-muted" : "bg-white border-gray-300 text-muted"}`}>{i + 1}</span>
          ))}
        </div>
        <TimerRing remaining={remaining} limit={limit} warn5={warn5} warn1={warn1} />
        <div className="flex-1 min-w-[10rem]">
          <div className="flex justify-between text-[11px] font-extrabold uppercase tracking-widest text-muted"><span>{t("round.progress")}</span>
            <span className="text-navy normal-case tracking-normal text-sm">{isTrial ? t("round.sentencesDone", { done: progress, total }) : t("round.paragraphsDone", { done: progress, total })}</span></div>
          <div className="mt-1 flex gap-[3px]" aria-hidden>
            {Array.from({ length: total }, (_, i) => (
              <motion.span key={i} className={`h-2.5 flex-1 rounded-full ${i < progress ? "bg-success" : "bg-gray-200"}`} animate={i === progress - 1 ? { scaleY: [1, 1.8, 1] } : {}} />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1.5" title={t("common.creditsUpTo", { n: creditCap })}>
          <Coin size={18} /><span className="text-sm font-extrabold text-amber-800">{t("common.creditsUpTo", { n: creditCap })}</span>
        </div>
        <span className={`text-xs font-bold rounded-full px-2.5 py-1 ${save === "offline" ? "bg-amber-50 text-amber-800" : "bg-success-soft text-green-800"}`} aria-live="polite">
          {save === "saving" ? "⟳ " + t("round.saving") : save === "offline" ? "⚠ " + t("round.offline") : "✓ " + t("round.saved")}
        </span>
      </div>
    </div>
  );
}
