import { useId, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { lineById, useConfig, useLines } from "../lib/queries";
import { sfx } from "../lib/sfx";
import { t, tList } from "../lib/strings";
import { Header, Page } from "../components/Layout";
import { GameButton, Medal } from "../components/Juice";
import { AcceptBurst, MissionSeal, ladderOf } from "../components/Onboarding";
import { Icon } from "../components/Icon";
import { SahayikaLine } from "../components/Sahayika";

interface RuleCard { icon: string; title: string; points: string[] }

/** The 100-point meter with the qualifying mark. */
function ScoreMeter({ max, pass }: { max: number; pass: number }) {
  const at = (pass / max) * 100;
  return (
    <div className="mt-4" role="img" aria-label={`${t("ob.rules.meterTitle")}: ${t("ob.rules.meterPass", { pass })}, ${t("ob.rules.meterMax", { max })}`}>
      <div className="relative h-4 rounded-full bg-white/10 ring-1 ring-white/15">
        <motion.div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary to-gold" initial={{ width: 0 }} animate={{ width: "100%" }} transition={{ duration: 1.4, delay: 0.6, ease: "easeOut" }} />
        <span className="absolute inset-y-[-5px] w-[3px] bg-white rounded" style={{ left: `${at}%` }} />
      </div>
      <div className="relative mt-1.5 h-9 text-[11px] font-bold">
        <span className="absolute left-0 text-blue-100/70 tnum">0</span>
        <span className="absolute -translate-x-1/2 text-center text-gold-light leading-tight whitespace-nowrap" style={{ left: `${Math.min(Math.max(at, 22), 70)}%` }}><span className="block tnum text-base">{pass}</span>{t("ob.rules.meterPassWord")}</span>
        <span className="absolute right-0 text-blue-100/70 tnum">{max}</span>
      </div>
    </div>
  );
}

/** Rules as a mission briefing: collectible cards in a dark briefing room, sealed with a hold-to-accept control. */
export function Rules() {
  const nav = useNavigate();
  const { data: cfg } = useConfig();
  const [agreed, setAgreed] = useState(false);
  const [seen, setSeen] = useState<Record<number, boolean>>({});
  const [fire, setFire] = useState(0);
  const labelId = useId();
  const { data: scriptLines } = useLines("before_game");
  const cards = tList<RuleCard>("ob.rules.cards");
  const ladder = ladderOf(cfg);
  const vars = { max: cfg?.scoreOutOf ?? 100, pass: cfg?.titlePassMark ?? 33 };
  const nSeen = Object.values(seen).filter(Boolean).length;
  const accept = (v: boolean) => { setAgreed(v); if (v) { setFire((f) => f + 1); sfx("fanfare"); } };
  return (
    <div className="rules-room">
      <Header />
      <Page>
        <AcceptBurst fire={fire} />
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-end justify-between gap-3 mb-5 text-white">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-gold-light flex items-center gap-2"><span className="w-5 h-[2px] bg-gold" />{t("ob.rules.briefKicker")}</div>
            <h1 className="mt-1 text-[1.9rem] sm:text-[2.35rem] font-extrabold leading-tight tracking-tight">{t("ob.rules.heading")}</h1>
            <p className="text-blue-100/85 mt-1">{t("ob.rules.sub")}</p>
          </div>
          <div className="rounded-full bg-white/10 border border-white/20 px-3.5 py-1.5 text-sm font-bold flex items-center gap-2" aria-live="polite">
            <span className="flex gap-1">{cards.map((_, i) => <span key={i} className={`w-2.5 h-2.5 rounded-full ${seen[i] ? "bg-gold" : "bg-white/25"}`} />)}</span>
            {t("ob.rules.briefed", { n: nSeen, total: cards.length })}
          </div>
        </motion.div>

        {/* Sahayak's briefing comes from the script, so edits in the manager console show up here */}
        <div className="mb-5 grid gap-2 lg:grid-cols-2">
          <SahayikaLine line={lineById(scriptLines, "before_game.screen.rules_open")} tone="blue" />
          <SahayikaLine line={lineById(scriptLines, "before_game.screen.rules_credits")} tone="blue" autoSpeak={false} />
        </div>

        <div className="grid sm:grid-cols-2 gap-4 sm:gap-5" style={{ perspective: 1200 }}>
          {cards.map((c, i) => {
            const done = !!seen[i];
            return (
              <motion.section key={c.title} initial={{ rotateY: -55, y: 24, opacity: 0 }} animate={{ rotateY: 0, y: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 140, damping: 18, delay: 0.1 + i * 0.12 }} whileHover={{ y: -4 }} aria-labelledby={`rule-${i}`}
                className={`mission-card ${done ? "is-done" : ""}`}>
                <span className="mission-crest" aria-hidden>{i + 1}</span>
                <div className="flex items-center gap-3 pl-9">
                  <span className="w-12 h-12 rounded-full grid place-items-center bg-gradient-to-br from-gold-light to-gold text-navy ring-4 ring-gold/25 shrink-0"><Icon name={c.icon as any} size={22} /></span>
                  <h2 id={`rule-${i}`} className="text-xl font-extrabold">{c.title}</h2>
                </div>
                {i < 3 ? (
                  <ul className="mt-3 space-y-1.5">
                    {c.points.map((p) => (
                      <li key={p} className="flex gap-2.5 text-[15px] leading-snug text-blue-50"><Icon name="check" size={16} stroke={2.6} className="mt-0.5 shrink-0 text-gold-light" />{p.replace("{max}", String(vars.max)).replace("{pass}", String(vars.pass))}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-3">
                    <ol className="flex items-start justify-between gap-1" aria-label={c.title}>
                      {ladder.map((r, n) => (
                        <motion.li key={r.key} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.7 + n * 0.12, type: "spring", stiffness: 260, damping: 16 }}
                          className="flex-1 min-w-0 flex flex-col items-center text-center relative">
                          {n > 0 && <span className="absolute top-5 -left-1/2 w-full border-t-2 border-dashed border-gold/50" aria-hidden />}
                          <span className="relative z-[1]"><Medal k={r.key} size={44} /></span>
                          <span className="mt-1 text-[11px] font-bold leading-tight">{r.name}</span>
                          {r.phase2 && <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-purple-200">{t("ob.train.score.phase2")}</span>}
                        </motion.li>
                      ))}
                    </ol>
                    <p className="mt-3 text-[13px] text-blue-100/80 flex items-center gap-1.5"><Icon name="sparkle" size={14} className="text-purple-200" />{t("ob.rules.ladderNote")}</p>
                  </div>
                )}
                {i === 2 && <ScoreMeter max={vars.max} pass={vars.pass} />}
                <button type="button" aria-pressed={done} onClick={() => { setSeen((s) => ({ ...s, [i]: !s[i] })); sfx(done ? "toggle" : "pop"); }}
                  className={`mission-ack ${done ? "is-on" : ""}`}>
                  <Icon name="check" size={14} stroke={3} />{done ? t("ob.rules.gotItDone") : t("ob.rules.gotIt")}
                </button>
              </motion.section>
            );
          })}
        </div>

        <p className="mt-4 flex items-start gap-2 text-sm text-blue-100/80"><Icon name="lock" size={16} className="mt-0.5 shrink-0 text-gold-light" />{t("ob.rules.fairPlay")}</p>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
          className={`mt-5 mission-dock ${agreed ? "is-accepted" : ""}`}>
          <MissionSeal accepted={agreed} onChange={accept} labelId={labelId} />
          <div className="flex-1 min-w-[14rem]">
            <div id={labelId} className="text-[1.05rem] font-bold text-white">{t("ob.rules.agree")}</div>
            <div className="mt-1 text-sm text-blue-100/80" aria-live="polite">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span key={agreed ? "y" : "n"} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="inline-flex items-start gap-1.5 text-left">
                  {agreed ? <><Icon name="check" size={15} stroke={3} className="text-gold-light" /><span><b className="text-gold-light">{t("ob.rules.accepted")}.</b> {t("ob.rules.acceptedSub")}</span></> : <><Icon name="lock" size={14} />{t("ob.rules.holdLabel")}</>}
                </motion.span>
              </AnimatePresence>
            </div>
            {!agreed && <div className="mt-0.5 text-[12px] text-blue-100/60">{t("ob.rules.holdKeys")}</div>}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <GameButton variant="light" onClick={() => nav("/how-to-play")}><Icon name="chevronLeft" size={18} /> {t("ob.rules.backToTraining")}</GameButton>
            <GameButton sound="whoosh" disabled={!agreed} aria-describedby={agreed ? undefined : "agree-hint"} onClick={() => nav("/journey")}
              className={`px-7 py-3.5 text-lg ${agreed ? "ob-pulse" : ""}`}>
              {t("ob.rules.enter")} <Icon name="arrowRight" size={18} />
            </GameButton>
          </div>
          {!agreed && <span id="agree-hint" className="sr-only">{t("ob.rules.agreeHint")}</span>}
        </motion.div>
      </Page>
    </div>
  );
}
