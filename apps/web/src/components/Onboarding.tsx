import { motion } from "framer-motion";
import type { PublicConfig } from "@hc/shared";
import { t } from "../lib/strings";
import { Coin } from "./Layout";
import { CountUp, Medal } from "./Juice";
import { Icon } from "./Icon";

type Round = PublicConfig["rounds"][number];

/** Warm onboarding backdrop: cream with soft tricolour swooshes at the edges (decorative). */
export function ObBackdrop({ children }: { children: React.ReactNode }) {
  return (
    <div className="ob-bg">
      <div className="ob-swoosh" aria-hidden>
        <svg viewBox="0 0 600 220" className="left-[-14%] top-[430px] opacity-70" fill="none"><path d="M0 150C120 40 300 20 600 120" stroke="#F15A24" strokeOpacity=".35" strokeWidth="14" strokeLinecap="round" /><path d="M0 178C140 76 320 56 600 150" stroke="#fff" strokeOpacity=".9" strokeWidth="10" strokeLinecap="round" /><path d="M0 204C160 112 340 92 600 178" stroke="#15803D" strokeOpacity=".28" strokeWidth="12" strokeLinecap="round" /></svg>
        <svg viewBox="0 0 600 220" className="right-[-14%] bottom-[30px] rotate-180" fill="none"><path d="M0 150C120 40 300 20 600 120" stroke="#F15A24" strokeOpacity=".3" strokeWidth="14" strokeLinecap="round" /><path d="M0 178C140 76 320 56 600 150" stroke="#fff" strokeOpacity=".9" strokeWidth="10" strokeLinecap="round" /><path d="M0 204C160 112 340 92 600 178" stroke="#15803D" strokeOpacity=".25" strokeWidth="12" strokeLinecap="round" /></svg>
      </div>
      {children}
    </div>
  );
}

/** One level on the credit ladder, derived only from config. */
export interface LadderRow { key: string; name: string; title: string; credits: number; phase2: boolean }
export function ladderOf(cfg: PublicConfig | undefined): LadderRow[] {
  return (cfg?.rounds ?? []).map((r: Round) => ({ key: r.key, name: r.nameEn, title: r.titleEn ?? r.title, credits: r.creditCap, phase2: r.playable === false || !!r.phase }));
}
/** The last (Phase 2) level's title, e.g. for copy that names the ultimate goal. */
export const finalTitle = (cfg: PublicConfig | undefined) => ladderOf(cfg).slice(-1)[0]?.title ?? "";

/** Cumulative credit milestones (registration, then each level in the pool). */
function milestones(cfg: PublicConfig) {
  let run = cfg.registration.credits;
  return [{ at: run, label: t("ob.reg.joining") }, ...ladderOf(cfg).filter((r) => !r.phase2).map((r) => ({ at: (run += r.credits), label: r.name }))];
}

/** Gold credit track: registration banked, then milestones up to the maximum. */
export function CreditTrack({ cfg, dark = false }: { cfg: PublicConfig; dark?: boolean }) {
  const max = cfg.maxCredits;
  const banked = cfg.registration.credits;
  const ms = milestones(cfg);
  return (
    <div>
      <div className="relative h-3.5 rounded-full bg-white/10 ring-1 ring-white/10" role="img" aria-label={`${banked} ${t("ob.reg.ofMax", { max })} ${t("common.credits")}`}>
        <motion.div className="absolute inset-y-0 left-0 rounded-full ob-gold-track" initial={{ width: 0 }} animate={{ width: `${Math.max(6, (banked / max) * 100)}%` }} transition={{ duration: 1.1, delay: 0.3, ease: "easeOut" }} />
        {ms.map((m, i) => (
          <span key={i} className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full border-2 ${i === 0 ? "bg-gold border-white" : dark ? "bg-navy border-white/50" : "bg-white border-slate-400"}`} style={{ left: `${(m.at / max) * 100}%` }} />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] font-bold tnum text-blue-100/80"><span>0</span><span>{max}</span></div>
    </div>
  );
}

/** "Your Rewards Journey": the why-play panel. Prominent credits, animated track, one chip per level. */
export function RewardsJourney({ cfg }: { cfg: PublicConfig }) {
  const rows = ladderOf(cfg);
  const join = cfg.registration.credits;
  return (
    <section className="card-dark hud-grid relative overflow-hidden p-5" aria-labelledby="ob-journey-h">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-primary via-gold to-transparent" aria-hidden />
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <h2 id="ob-journey-h" className="text-xl font-extrabold tracking-tight">{t("ob.reg.journeyHeading")}</h2>
          <p className="mt-0.5 text-[13px] text-blue-100/80">{t("ob.reg.journeySub", { max: cfg.maxCredits })}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-4xl font-extrabold text-gold-light tnum leading-none"><CountUp to={cfg.maxCredits} duration={1.4} /></div>
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-100/70 mt-1">{t("ob.reg.upTo")} {t("ob.reg.creditsWord")}</div>
        </div>
      </div>
      <div className="mt-4"><CreditTrack cfg={cfg} dark /></div>
      <ol className="mt-3 grid gap-1.5">
        <motion.li initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} whileHover={{ y: -2 }}
          className="flex items-center gap-3 rounded-ui bg-gold/15 border border-gold/50 px-3 py-2">
          <span className="ob-coin-shine shrink-0"><Coin size={34} /></span>
          <span className="flex-1 min-w-0"><span className="block font-bold leading-tight">{t("ob.reg.joining")}</span><span className="block text-[12px] text-blue-100/75">{t("ob.reg.joiningNote")}</span></span>
          <span className="text-lg font-extrabold text-gold-light tnum">+<CountUp to={join} /></span>
        </motion.li>
        {rows.map((r, i) => (
          <motion.li key={r.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 + i * 0.1 }} whileHover={{ y: -2 }}
            className={`flex items-center gap-3 rounded-ui border px-3 py-1.5 ${r.phase2 ? "border-dashed border-white/25 bg-white/[0.03]" : "border-white/10 bg-white/[0.06]"}`}>
            <Medal k={r.key} size={36} locked={false} />
            <span className="flex-1 min-w-0"><span className="block font-semibold leading-tight truncate">{r.title}</span><span className="block text-[12px] text-blue-100/75">{r.name}</span></span>
            {r.phase2
              ? <span className="text-right"><span className="chip !py-0.5 bg-purple-500/25 border-purple-300/40 text-purple-100 text-[11px]">{t("ob.reg.phase2")}</span><span className="block text-[10px] text-blue-100/60 mt-0.5">{t("ob.reg.phase2Note", { max: cfg.maxCredits })}</span></span>
              : <span className="text-lg font-extrabold text-white tnum">+{r.credits}</span>}
          </motion.li>
        ))}
      </ol>
      <div className="mt-3 pt-3 border-t border-white/15 flex items-center justify-between text-sm">
        <span className="text-blue-100/80 inline-flex items-center gap-1.5"><Icon name="coin" size={15} />{t("ob.reg.maxLabel")}</span>
        <span className="font-extrabold text-gold-light tnum text-lg">{cfg.maxCredits} {t("common.credits")}</span>
      </div>
    </section>
  );
}
