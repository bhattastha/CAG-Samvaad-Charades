import { useId, useState } from "react";
import { motion } from "framer-motion";
import type { PublicConfig, Summary } from "@hc/shared";
import { t } from "../../lib/strings";
import { sfx } from "../../lib/sfx";
import { Icon } from "../../components/Icon";

export type StageState = "available" | "played" | "completed" | "locked" | "upcoming";

/** Each milestone's collectible identity; colours move warm → cool → royal → gold along the path. */
const STAGE: Record<string, { icon: string; a: string; b: string; glow: string }> = {
  trial: { icon: "book", a: "#FCD34D", b: "#E85A1A", glow: "rgba(245,158,11,.55)" },
  primary: { icon: "files", a: "#7DD3FC", b: "#1D4E89", glow: "rgba(56,189,248,.5)" },
  secondary: { icon: "chart", a: "#C4B5FD", b: "#6D28D9", glow: "rgba(167,139,250,.5)" },
  pro: { icon: "image", a: "#5EEAD4", b: "#0F766E", glow: "rgba(45,212,191,.5)" },
  varchaspati: { icon: "trophy", a: "#FDE68A", b: "#B8862B", glow: "rgba(250,204,21,.6)" },
};

/** Status of each stage from the real game state (signed in) or the unlock rule (visitor). */
export function stageStates(cfg: PublicConfig, summary?: Summary): Record<string, StageState> {
  const out: Record<string, StageState> = {};
  const allOpen = cfg.levels?.unlockRule === "all-open";
  for (const r of cfg.rounds) {
    if (r.playable === false) { out[r.key] = "upcoming"; continue; }
    const s = summary?.rounds.find((x) => x.key === r.key);
    if (!s) { out[r.key] = allOpen || r.key === "trial" ? "available" : "locked"; continue; }
    out[r.key] = s.titleEarned ? "completed" : !s.unlocked ? "locked" : s.played > 0 ? "played" : "available";
  }
  return out;
}

// S-curve in a 1200 × 300 box; milestones sit on the curve
const VB = { w: 1200, h: 260 };
const NODES = [{ x: 110, y: 165 }, { x: 355, y: 95 }, { x: 600, y: 170 }, { x: 845, y: 95 }, { x: 1090, y: 160 }];
const PATH = "M 0 195 C 60 190, 70 165, 110 165 S 260 93, 355 95 S 500 170, 600 170 S 760 93, 845 95 S 1000 162, 1090 160 S 1180 95, 1200 85";

function Emblem({ k, state, size }: { k: string; state: StageState; size: number }) {
  const s = STAGE[k] ?? STAGE.trial;
  const dim = state === "locked";
  // unique per instance: the desktop path and the phone list both render emblems, and gradients defined
  // inside a display:none SVG do not paint for the other copy
  const uid = useId().replace(/:/g, "");
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      {/* pedestal light */}
      <span className="absolute -bottom-[18%] left-1/2 -translate-x-1/2 w-[120%] h-[34%] rounded-[50%] blur-md" style={{ background: dim ? "rgba(148,163,184,.25)" : s.glow }} aria-hidden />
      <svg viewBox="0 0 100 100" width={size} height={size} className="relative drop-shadow-[0_10px_18px_rgba(0,0,0,.45)]" aria-hidden>
        <defs>
          <linearGradient id={`lg-${k}-${uid}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={dim ? "#CBD5E1" : s.a} /><stop offset="1" stopColor={dim ? "#475569" : s.b} /></linearGradient>
          <radialGradient id={`rg-${k}-${uid}`} cx="35%" cy="28%" r="75%"><stop offset="0" stopColor="#fff" stopOpacity=".55" /><stop offset=".55" stopColor="#fff" stopOpacity="0" /></radialGradient>
        </defs>
        {k === "varchaspati" && !dim && <path d="M30 18l8 9 12-14 12 14 8-9 2 14H28z" fill="#FDE68A" stroke="#B8862B" strokeWidth="1.2" />}
        <circle cx="50" cy="54" r="38" fill={`url(#lg-${k}-${uid})`} stroke="rgba(255,255,255,.7)" strokeWidth="2" />
        <circle cx="50" cy="54" r="31" fill="rgba(7,26,51,.35)" stroke="rgba(255,255,255,.35)" strokeWidth="1" />
        <circle cx="50" cy="54" r="38" fill={`url(#rg-${k}-${uid})`} />
      </svg>
      <span className="absolute grid place-items-center text-white" style={{ top: size * 0.24, width: size * 0.62, height: size * 0.62 }}>
        <Icon name={dim ? "lock" : s.icon} size={size * 0.34} stroke={1.9} />
      </span>
    </div>
  );
}

function StageTip({ k, state, title }: { k: string; state: StageState; title: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}
      className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-60 rounded-xl border border-white/15 bg-[#071A33]/90 backdrop-blur-md p-3 text-left shadow-2xl pointer-events-none z-20" role="tooltip">
      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#F3D58A]">{title}</div>
      <p className="mt-1 text-[13px] leading-snug text-blue-50/90">{t(`landing.stages.${k}.desc`)}</p>
      <span className={`mt-2 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold ${state === "completed" ? "bg-emerald-400/20 text-emerald-200" : state === "locked" ? "bg-white/10 text-slate-300" : state === "upcoming" ? "bg-purple-400/20 text-purple-200" : "bg-orange-400/20 text-orange-200"}`}>
        <Icon name={state === "completed" ? "check" : state === "locked" ? "lock" : state === "upcoming" ? "sparkle" : "play"} size={11} /> {t(`landing.states.${state}`)}
      </span>
    </motion.div>
  );
}

/** Desktop: the five milestones on a flowing golden S-curve. Mobile: the same journey as a vertical trail. */
export function JourneyPath({ cfg, states, onStage }: { cfg: PublicConfig; states: Record<string, StageState>; onStage(key: string, state: StageState): void }) {
  const [hover, setHover] = useState<string | null>(null);
  const [shake, setShake] = useState<string | null>(null);
  const press = (k: string) => {
    const st = states[k];
    if (st === "locked") { sfx("error"); setShake(k); setTimeout(() => setShake(null), 450); return; }
    sfx("whoosh");
    onStage(k, st);
  };
  const rounds = cfg.rounds.slice(0, 5);
  const label = (k: string, i: number) => `${t("landing.stageLabel", { n: i + 1 })}: ${t(`landing.stages.${k}.name`)}, ${rounds[i].titleEn}, ${t(`landing.states.${states[k]}`)}`;
  return (
    <>
      {/* desktop / tablet landscape */}
      <div className="relative hidden lg:block w-full mb-16" style={{ aspectRatio: `${VB.w} / ${VB.h}` }} aria-label={t("landing.journeyLabel")} role="list">
        <svg viewBox={`0 0 ${VB.w} ${VB.h}`} className="absolute inset-0 w-full h-full overflow-visible pointer-events-none" aria-hidden>
          <defs>
            <linearGradient id="trail" x1="0" x2="1"><stop offset="0" stopColor="#F59E0B" stopOpacity=".15" /><stop offset=".08" stopColor="#F59E0B" /><stop offset=".5" stopColor="#FDE68A" /><stop offset=".92" stopColor="#F59E0B" /><stop offset="1" stopColor="#F59E0B" stopOpacity=".2" /></linearGradient>
            <filter id="trailGlow" x="-10%" y="-50%" width="120%" height="200%"><feGaussianBlur stdDeviation="6" /></filter>
          </defs>
          <path d={PATH} fill="none" stroke="#F59E0B" strokeOpacity=".35" strokeWidth="16" filter="url(#trailGlow)" />
          <motion.path d={PATH} fill="none" stroke="url(#trail)" strokeWidth="4" strokeLinecap="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.8, ease: [0.4, 0, 0.2, 1], delay: 0.5 }} />
          {/* a light pulse travelling the path */}
          <path d={PATH} fill="none" stroke="#FFF7D6" strokeWidth="3" strokeLinecap="round" strokeDasharray="40 1400" className="lp-pulse" />
          {/* sparks travelling the journey */}
          <g className="lp-sparks">
            {[0, 2.2, 4.4].map((d) => (
              <circle key={d} r="4" fill="#FFF3C4" style={{ filter: "drop-shadow(0 0 6px #FFC14D)" }}>
                <animateMotion dur="6.6s" begin={`${d}s`} repeatCount="indefinite" path={PATH} rotate="auto" />
                <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.1;.85;1" dur="6.6s" begin={`${d}s`} repeatCount="indefinite" />
              </circle>
            ))}
          </g>
        </svg>
        {rounds.map((r, i) => {
          const st = states[r.key];
          const n = NODES[i];
          return (
            <motion.div key={r.key} role="listitem" className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${(n.x / VB.w) * 100}%`, top: `${(n.y / VB.h) * 100}%` }}
              initial={{ opacity: 0, y: 24, scale: 0.85 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 150, damping: 16, delay: 0.9 + i * 0.16 }}>
              <motion.button type="button" onClick={() => press(r.key)} onMouseEnter={() => setHover(r.key)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(r.key)} onBlur={() => setHover(null)}
                aria-label={label(r.key, i)} data-state={st}
                animate={shake === r.key ? { x: [0, -6, 6, -4, 0] } : {}} whileHover={{ y: -8 }} whileTap={{ scale: 0.95 }}
                className="relative flex flex-col items-center gap-1.5 text-center outline-none group focus-visible:[&_.lp-ring]:opacity-100">
                {hover === r.key && <StageTip k={r.key} state={st} title={r.titleEn ?? ""} />}
                <span className="lp-ring absolute -inset-2 rounded-full ring-2 ring-[#F3D58A] opacity-0 transition" aria-hidden />
                <span className="relative lp-float" style={{ animationDelay: `${i * -0.7}s` }}>
                  {/* beacon: lights each milestone in turn, in step with the sparks */}
                  {st !== "locked" && <span className="lp-beacon absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ width: (i === 4 ? 96 : 84) + 28, height: (i === 4 ? 96 : 84) + 28, animationDelay: `${i * 1.32}s`, ["--beacon" as string]: STAGE[r.key]?.glow ?? "rgba(250,204,21,.6)" }} aria-hidden />}
                  <Emblem k={r.key} state={st} size={i === 4 ? 96 : 84} />
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-[#071A33] border-2 border-[#F3D58A] grid place-items-center text-[15px] font-extrabold text-white shadow-lg">{i + 1}</span>
                  {st === "completed" && <span className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-emerald-500 border-2 border-white grid place-items-center text-white lp-pop"><Icon name="check" size={15} stroke={3} /></span>}
                  {st === "upcoming" && <span className="absolute -top-1 -right-3 rounded-md bg-purple-600/90 border border-purple-300/50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">{t("landing.states.upcoming")}</span>}
                </span>
                <span className="mt-2 text-[17px] font-bold text-white drop-shadow tracking-wide">{t(`landing.stages.${r.key}.name`)}</span>
                <span className="text-[14px] font-semibold text-[#F3D58A] drop-shadow whitespace-nowrap">{r.titleEn}</span>
              </motion.button>
            </motion.div>
          );
        })}
      </div>

      {/* phone: vertical trail */}
      <ol className="lg:hidden relative pl-2 max-w-xl mx-auto" aria-label={t("landing.journeyLabel")}>
        <svg className="absolute left-[34px] top-6 bottom-6 w-6 h-[calc(100%-3rem)]" viewBox="0 0 24 100" preserveAspectRatio="none" aria-hidden>
          <path d="M12 0 C 22 12, 2 25, 12 37 S 22 62, 12 75 S 2 92, 12 100" fill="none" stroke="#F59E0B" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeOpacity=".55" />
          <path d="M12 0 C 22 12, 2 25, 12 37 S 22 62, 12 75 S 2 92, 12 100" fill="none" stroke="#FFE7A3" strokeWidth="3" vectorEffect="non-scaling-stroke" strokeDasharray="10 26" className="lp-flow" />
        </svg>
        {rounds.map((r, i) => {
          const st = states[r.key];
          return (
            <motion.li key={r.key} initial={{ opacity: 0, x: -12 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}>
              <button type="button" onClick={() => press(r.key)} aria-label={label(r.key, i)} data-state={st}
                className="relative w-full flex items-center gap-4 py-3 text-left">
                <span className="relative shrink-0 lp-float" style={{ animationDelay: `${i * -0.7}s` }}>
                  {st !== "locked" && <span className="lp-beacon absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ width: 80, height: 80, animationDelay: `${i * 1.32}s`, ["--beacon" as string]: STAGE[r.key]?.glow ?? "rgba(250,204,21,.6)" }} aria-hidden />}
                  <Emblem k={r.key} state={st} size={60} />
                  <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#071A33] border-2 border-[#F3D58A] grid place-items-center text-[12px] font-extrabold text-white">{i + 1}</span></span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[17px] font-bold text-white">{t(`landing.stages.${r.key}.name`)}</span>
                  <span className="block text-[14px] font-semibold text-[#F3D58A]">{r.titleEn}</span>
                </span>
                <span className={`text-[11px] font-bold uppercase tracking-wider ${st === "completed" ? "text-emerald-300" : st === "locked" ? "text-slate-400" : st === "upcoming" ? "text-purple-200" : "text-orange-200"}`}>{t(`landing.states.${st}`)}</span>
              </button>
            </motion.li>
          );
        })}
      </ol>
    </>
  );
}
