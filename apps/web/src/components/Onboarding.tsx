import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { PublicConfig } from "@hc/shared";
import { t, tList } from "../lib/strings";
import { sfx } from "../lib/sfx";
import { Coin } from "./Layout";
import { Burst, CountUp, Medal } from "./Juice";
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
export function RewardsJourney({ cfg, hero = false }: { cfg: PublicConfig; hero?: boolean }) {
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
      {hero && (
        <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 180, damping: 15, delay: 0.1 }}
          className="mt-4 relative overflow-hidden rounded-card border border-gold/60 bg-gradient-to-br from-gold/30 via-gold/10 to-transparent px-4 py-4 flex items-center gap-4">
          <span className="ob-coin-shine shrink-0 ob-pulse"><Coin size={64} /></span>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-gold-light">{t("ob.reg.joining")}</div>
            <div className="text-5xl font-extrabold text-gold-light tnum leading-none mt-1">+<CountUp to={join} duration={1.2} /> <span className="text-xl">{t("common.credits")}</span></div>
            <div className="text-[13px] text-blue-100/85 mt-1">{t("ob.reg.heroNote")}</div>
          </div>
        </motion.div>
      )}
      <div className="mt-4"><CreditTrack cfg={cfg} dark /></div>
      <ol className="mt-3 grid gap-1.5">
        {!hero && <motion.li initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} whileHover={{ y: -2 }}
          className="flex items-center gap-3 rounded-ui bg-gold/15 border border-gold/50 px-3 py-2">
          <span className="ob-coin-shine shrink-0"><Coin size={34} /></span>
          <span className="flex-1 min-w-0"><span className="block font-bold leading-tight">{t("ob.reg.joining")}</span><span className="block text-[12px] text-blue-100/75">{t("ob.reg.joiningNote")}</span></span>
          <span className="text-lg font-extrabold text-gold-light tnum">+<CountUp to={join} /></span>
        </motion.li>}
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

function prefersReducedMotion() {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("hc-reduce-motion") || !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

// ---------------------------------------------------------------- transliteration explainer

const XLIT_EXAMPLES = [
  { roman: "namaste", opts: ["नमस्ते", "नमस्कार", "नमः"], rest: ", ..." },
  { roman: "sarkar", opts: ["सरकार", "सरकारी", "सरकारों"], rest: " ने ..." },
  { roman: "lekhaparikshak", opts: ["लेखापरीक्षक", "लेखा परीक्षक", "लेखापरीक्षकों"], rest: " ने ..." },
];

/** Three-beat looping explainer: type Roman letters, see Hindi suggestions, accept one. Illustrative only. */
export function TranslitExplainer() {
  const [ex, setEx] = useState(0);
  const [beat, setBeat] = useState(0);
  const [n, setN] = useState(0);
  const [playing, setPlaying] = useState(() => !prefersReducedMotion());
  const e = XLIT_EXAMPLES[ex];
  const stages = tList("ob.train.toolkit.xlit.stage");
  useEffect(() => {
    if (!playing) return;
    let id: ReturnType<typeof setTimeout>;
    if (beat === 0) id = n < e.roman.length ? setTimeout(() => setN(n + 1), 140) : setTimeout(() => setBeat(1), 600);
    else if (beat === 1) id = setTimeout(() => setBeat(2), 2300);
    else id = setTimeout(() => { setEx((ex + 1) % XLIT_EXAMPLES.length); setBeat(0); setN(0); }, 2800);
    return () => clearTimeout(id);
  }, [playing, beat, n, ex, e.roman.length]);
  const goBeat = (b: number) => { setPlaying(false); setBeat(b); setN(e.roman.length); sfx("toggle"); };
  const typed = e.roman.slice(0, beat === 0 ? n : e.roman.length);
  return (
    <div className="xl-stage hud-grid rounded-card text-white p-4 sm:p-5 relative overflow-hidden" translate="no">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-100/70">{t("ob.train.toolkit.xlit.illustration")}</div>
        <button type="button" onClick={() => setPlaying((p) => !p)} className="xl-ctl" aria-label={playing ? t("ob.train.toolkit.xlit.pause") : t("ob.train.toolkit.xlit.play")}>
          <Icon name={playing ? "pause" : "play"} size={15} />
        </button>
      </div>
      <div className="mt-3 flex items-center gap-2.5 min-h-[28px]" aria-live="off">
        <span className="w-7 h-7 rounded-full bg-primary text-white grid place-items-center text-sm font-extrabold tnum shrink-0">{beat + 1}</span>
        <AnimatePresence mode="wait">
          <motion.span key={beat} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="font-bold text-[1.02rem] sm:text-lg">{stages[beat]}</motion.span>
        </AnimatePresence>
      </div>

      {/* 1: keyboard-style input line */}
      <div className="mt-3 rounded-ui bg-white/10 border border-white/15 px-3 py-3 min-h-[60px] flex flex-wrap items-center gap-1.5" aria-hidden>
        {typed.split("").map((ch, i) => (
          <motion.span key={`${ex}-${i}`} initial={{ y: -8, opacity: 0, scale: 0.8 }} animate={{ y: 0, opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 22 }} className="xl-key">{ch}</motion.span>
        ))}
        {beat === 0 && <span className="xl-caret" />}
      </div>

      {/* 2: suggestion bar */}
      <div className="mt-2 min-h-[56px]" aria-hidden>
        <AnimatePresence>
          {beat >= 1 && (
            <motion.div key={ex} initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 260, damping: 22 }}
              className="inline-flex flex-wrap gap-1.5 rounded-ui bg-white text-navy p-1.5 shadow-pop">
              {e.opts.map((o, i) => (
                <motion.span key={o} animate={beat === 2 && i === 0 ? { scale: [1, 1.08, 1] } : {}} transition={{ duration: 0.4 }}
                  className={`inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[1.05rem] font-semibold ${i === 0 ? "bg-primary text-white" : "bg-navy-50"}`}>
                  <span className={`text-[11px] font-bold tnum w-4 h-4 rounded grid place-items-center ${i === 0 ? "bg-white/25" : "bg-white text-navy-600"}`}>{i + 1}</span>{o}
                </motion.span>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 3: Space key + Hindi line */}
      <div className="mt-2 flex items-center gap-3" aria-hidden>
        <motion.span animate={beat === 2 ? { y: [0, 3, 0], boxShadow: ["0 3px 0 #0B2342", "0 0 0 #0B2342", "0 3px 0 #0B2342"] } : {}} transition={{ duration: 0.5, delay: 0.2 }}
          className={`xl-key xl-space ${beat === 2 ? "!bg-gold !text-navy" : "opacity-60"}`}>{t("ob.train.toolkit.xlit.spaceKey")}</motion.span>
        <div className="flex-1 min-w-0 rounded-ui border border-dashed border-white/30 px-3 py-2 min-h-[48px] flex items-center text-xl sm:text-2xl font-semibold" lang="hi">
          {beat === 2
            ? <motion.span key={ex} initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}><span className="text-gold-light">{e.opts[0]}</span>{e.rest}</motion.span>
            : <span className="text-white/35">...</span>}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        {[0, 1, 2].map((b) => (
          <button key={b} type="button" onClick={() => goBeat(b)} aria-label={t("ob.train.toolkit.xlit.beat", { n: b + 1 })} aria-current={beat === b}
            className={`h-2.5 rounded-full transition-all ${beat === b ? "w-8 bg-primary" : "w-2.5 bg-white/30 hover:bg-white/50"}`} />
        ))}
      </div>
      <ol className="sr-only">{stages.map((x: string) => <li key={x}>{x}</li>)}</ol>
    </div>
  );
}

// ---------------------------------------------------------------- hold-to-accept seal

/** Wax-seal control. Mouse/touch: press and hold to fill the ring. Keyboard / assistive tech: Space, Enter or click toggles. */
export function MissionSeal({ accepted, onChange, labelId }: { accepted: boolean; onChange(v: boolean): void; labelId: string }) {
  const [p, setP] = useState(0);
  const raf = useRef(0);
  const t0 = useRef(0);
  const viaPointer = useRef(false);
  const held = useRef(false);
  const HOLD = 1100;
  const stop = () => { cancelAnimationFrame(raf.current); raf.current = 0; };
  useEffect(() => stop, []);
  const tick = () => {
    const f = Math.min(1, (performance.now() - t0.current) / HOLD);
    setP(f);
    if (f >= 1) { stop(); held.current = true; onChange(true); return; }
    raf.current = requestAnimationFrame(tick);
  };
  const down = (e: React.PointerEvent) => {
    viaPointer.current = true;
    held.current = false;
    if (accepted) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    t0.current = performance.now();
    sfx("toggle");
    raf.current = requestAnimationFrame(tick);
  };
  const up = () => { if (!accepted) { stop(); setP(0); } };
  const R = 52, C = 2 * Math.PI * R;
  const full = accepted || p >= 1;
  return (
    <button type="button" role="switch" aria-checked={accepted} aria-labelledby={labelId}
      onPointerDown={down} onPointerUp={up} onPointerCancel={up} onPointerLeave={up}
      onClick={() => { const pointer = viaPointer.current; viaPointer.current = false; if (held.current) { held.current = false; return; } if (!pointer || accepted) { onChange(!accepted); if (accepted) { setP(0); sfx("toggle"); } } }}
      className="mission-seal group relative shrink-0 w-[132px] h-[132px] rounded-full select-none touch-none outline-none focus-visible:ring-4 focus-visible:ring-gold/70">
      <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="7" />
        <circle cx="60" cy="60" r={R} fill="none" stroke="#D6A642" strokeWidth="7" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - (accepted ? 1 : p))} />
      </svg>
      <motion.span animate={{ scale: accepted ? 1 : 1 - p * 0.06 }} className={`absolute inset-[14px] rounded-full grid place-items-center border-4 ${full ? "bg-gradient-to-br from-gold-light to-gold border-gold-light text-navy" : "bg-gradient-to-br from-primary to-primary-strong border-primary-ring/60 text-white"} shadow-pop`} aria-hidden>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={full ? "ok" : "no"} initial={{ scale: 0.4, rotate: -30, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 320, damping: 16 }}>
            <Icon name={full ? "check" : "shield"} size={full ? 44 : 38} stroke={full ? 3 : 2} />
          </motion.span>
        </AnimatePresence>
      </motion.span>
    </button>
  );
}

/** Fires a particle burst whenever `fire` increments. */
export const AcceptBurst = ({ fire }: { fire: number }) => <Burst fire={fire} count={36} spread={260} />;
