import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useConfig } from "../lib/queries";
import { sfx } from "../lib/sfx";
import { lineText, t } from "../lib/strings";
import type { Line } from "../lib/voice";
import { Coin, Header, Page, PageTitle, ProgressBar, Spinner, Stars } from "../components/Layout";
import { SahayikaLine, SahayikaPanel } from "../components/Sahayika";
import { Ambient, Burst, CountUp, GameButton, Medal, Stamp } from "../components/Juice";

export interface ReportData {
  attemptId: string; roundKey: string; roundName: string; title: string; limitMinutes: number; chanceNo: number; maxChances: number;
  playerName: string; score: number; autoSubmitted: boolean;
  counts: { translation10: number; sentence10: number; completionDone: number; completionTotal: number; completionUnit: "sentence" | "paragraph"; glossaryCorrect: number; glossaryTotal: number; usedMinutes: number; limitMinutes: number };
  measures: { translation: number; completion: number; sentence: number; glossary: number; time: number };
  best: number; chances: (number | null)[]; bestChance: number | null; titleEarned: boolean; roundCredits: number; totalCredits: number; maxCredits: number;
  stars: number; starsTotal: number; chancesLeft: number; leftCount: number;
  announce: Line[]; titleNeeded: Line | null; tip: Line; after: Line[];
  nextRound: { key: string; name: string; unlocked: boolean } | null;
  trialPassed: boolean;
  trialQualifyingScore: number;
  sessionId: string | null;
}

type Phase = "stamp" | "scoring" | "card";

function bars(r: ReportData) {
  const c = r.counts;
  return [
    ["📝", t("reportCard.measureTranslation"), t("reportCard.measureTranslationSub"), r.measures.translation, t("reportCard.marksOf10", { n: c.translation10 }), "bg-primary"],
    ["⏱", t("reportCard.measureTime"), t("reportCard.measureTimeSub"), r.measures.time, t("reportCard.timeMin", { used: c.usedMinutes, limit: c.limitMinutes }), "bg-purple-500"],
    ["✅", t("reportCard.measureCompletion"), t("reportCard.measureCompletionSub"), r.measures.completion,
      c.completionUnit === "sentence" ? t("reportCard.sentencesOf", { n: c.completionDone, total: c.completionTotal }) : t("reportCard.paragraphsOf", { n: c.completionDone, total: c.completionTotal }), "bg-royal-bright"],
    ["📖", t("reportCard.measureGlossary"), t("reportCard.measureGlossarySub"), r.measures.glossary, t("reportCard.wordsOf", { n: c.glossaryCorrect, total: c.glossaryTotal }), "bg-amber-500"],
    ["🧩", t("reportCard.measureSentence"), t("reportCard.measureSentenceSub"), r.measures.sentence, t("reportCard.marksOf10", { n: c.sentence10 }), "bg-success"],
  ] as const;
}

/** Interstitial: the stamp, then the "scoring machine" filling the five stats one by one. */
function Interstitial({ r, phase, onNext, roundLabel }: { r: ReportData; phase: Phase; onNext(): void; roundLabel: string }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (phase === "stamp") { sfx(r.autoSubmitted ? "warn" : "success"); const tm = setTimeout(onNext, 1700); return () => clearTimeout(tm); }
    if (phase === "scoring") {
      if (shown < 5) { const tm = setTimeout(() => { setShown(shown + 1); sfx("tick"); }, 450); return () => clearTimeout(tm); }
      const tm = setTimeout(onNext, 900);
      return () => clearTimeout(tm);
    }
  }, [phase, shown]);
  return (
    <div className="fixed inset-0 z-[90] bg-gradient-to-br from-navy via-royal-deep to-royal-bright text-white grid place-items-center p-6" onClick={onNext} role="status" aria-live="polite">
      <Ambient density={12} />
      <AnimatePresence mode="wait">
        {phase === "stamp" ? (
          <motion.div key="stamp" exit={{ opacity: 0, scale: 0.8 }} className="text-center">
            <Stamp text={r.autoSubmitted ? t("complete.timeUp") : t("complete.missionComplete")} tone={r.autoSubmitted ? "warn" : "good"} />
            <div className="mt-6 text-blue-100 font-semibold">{roundLabel}</div>
          </motion.div>
        ) : (
          <motion.div key="scoring" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="w-full max-w-lg">
            <div className="text-center text-sm font-extrabold uppercase tracking-[0.3em] text-orange-200">{t("complete.measuring")}</div>
            <div className="mt-2 text-center text-lg">{t("complete.scoring")}</div>
            <div className="mt-6 space-y-3">
              {bars(r).map(([ic, label, , v, count, c], i) => (
                <motion.div key={label} initial={{ opacity: 0, x: -20 }} animate={i < shown ? { opacity: 1, x: 0 } : { opacity: 0.25, x: 0 }} className="grid grid-cols-[2rem_7rem_1fr_6rem] items-center gap-3">
                  <span className="text-xl">{ic}</span><span className="font-bold">{label}</span>
                  <div className="h-3 rounded-full bg-white/15 overflow-hidden"><motion.div className={`h-full ${c}`} initial={{ width: 0 }} animate={{ width: i < shown ? `${v * 100}%` : 0 }} transition={{ type: "spring", stiffness: 70 }} /></div>
                  <span className="text-right font-extrabold tabular-nums">{i < shown ? count : "…"}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <button className="absolute bottom-6 right-6 text-white/70 underline font-semibold" onClick={(e) => { e.stopPropagation(); onNext(); }}>{t("common.skip")} →</button>
    </div>
  );
}

/** §7.7 Report card — designs 06, 09, 11, 13. */
export function Report() {
  const { id = "" } = useParams();
  const [sp, setSp] = useSearchParams();
  const nav = useNavigate();
  const { data: cfg } = useConfig();
  const { data: r } = useQuery({ queryKey: ["report", id], queryFn: () => api<ReportData>(`/attempts/${id}/report`) });
  // the mission-complete sequence plays once per attempt (not again on Back / refresh)
  const seenKey = `hc.fx.${id}`;
  const seen = (() => { try { return sessionStorage.getItem(seenKey) === "1"; } catch { return false; } })();
  const [phase, setPhase] = useState<Phase>(sp.get("fx") && !seen ? "stamp" : "card");
  const [burst, setBurst] = useState(0);
  useEffect(() => {
    if (phase !== "card" || !r) return;
    try { sessionStorage.setItem(seenKey, "1"); } catch { /* ignore */ }
    if (sp.get("fx")) setSp({}, { replace: true });
    if (r.titleEarned) { const tm = setTimeout(() => { setBurst(1); sfx("fanfare"); }, 700); return () => clearTimeout(tm); }
    sfx("coin");
  }, [phase, r]);
  if (!r) return <><Header /><Spinner /></>;
  const round = cfg?.rounds.find((x) => x.key === r.roundKey);
  if (phase !== "card") return <Interstitial r={r} phase={phase} roundLabel={round ? `${round.nameEn} Round` : ""} onNext={() => setPhase(phase === "stamp" ? "scoring" : "card")} />;

  const next = r.nextRound ? cfg?.rounds.find((x) => x.key === r.nextRound!.key) : null;
  const titleLine = r.announce[0];
  const restLines = r.announce.slice(2);
  return (
    <>
      <Header />
      <Burst fire={burst} count={48} spread={360} />
      <Page>
        <PageTitle hi={t("reportCard.heading", { roundName: round ? `${round.nameEn} Round` : r.roundName })} en={t("reportCard.headingEn")}
          right={<span className="chip-plain text-base">{t("common.chanceOf", { n: r.chanceNo, max: r.maxChances })}</span>} />
        <div className="grid lg:grid-cols-[1fr_1.35fr] gap-6">
          <SahayikaPanel lines={[titleLine, ...restLines]} title={t("reportCard.sahayikaAnnounces")}>
            {r.titleEarned ? (
              <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.6 }}
                className="flex items-center gap-4 rounded-2xl bg-white/10 border border-white/25 p-4">
                <Medal k={r.roundKey} size={84} shine />
                <div>
                  <div className="text-xs font-extrabold uppercase tracking-[0.25em] text-orange-200">{t("complete.titleUnlocked")}</div>
                  <div className="text-3xl font-extrabold">{round?.titleEn ?? r.title}</div>
                  <div className="text-blue-100">{round?.titleMeaning}</div>
                </div>
              </motion.div>
            ) : (
              <div className="rounded-card bg-white/10 border border-white/30 text-center py-4 px-3 flex items-center gap-3"><Medal k={r.roundKey} size={48} locked /><span className="text-left">{lineText(r.titleNeeded)}</span></div>
            )}
            <div className="flex items-center justify-between gap-3">
              <motion.span initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.9 }}
                className="inline-flex items-center gap-2 rounded-full bg-amber-400 text-navy px-5 py-2 text-xl font-extrabold shadow-glow">
                <Coin size={24} /> +<CountUp to={r.roundCredits} decimals={1} />
              </motion.span>
              <span className="text-lg font-bold">{t("reportCard.runningTotal", { n: r.totalCredits })}</span>
            </div>
            <div className="flex items-center justify-between"><Stars n={r.stars} total={r.starsTotal} size={34} animate /><span className="text-sm text-blue-100">{t("reportCard.starsLabel")}</span></div>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.4 }} className="mt-auto rounded-2xl bg-white text-navy p-4 flex items-center gap-3 shadow-card">
              <Medal k={!r.titleEarned ? r.roundKey : next?.key ?? r.roundKey} size={52} locked={!r.titleEarned || !!next} />
              <div className="flex-1">
                <div className="text-[11px] font-extrabold uppercase tracking-widest text-royal">🎯 {t("reportCard.nextGoal")}</div>
                <div className="font-bold leading-snug">
                  {r.roundKey === "trial" && !r.trialPassed ? t("reportCard.goalTrial", { n: Math.max(0, r.trialQualifyingScore - r.best) })
                    : !r.titleEarned ? t("reportCard.goalTitle", { n: Math.max(0, (cfg?.titlePassMark ?? 33) - r.best), title: round?.titleEn ?? r.title })
                      : next ? t("reportCard.goalNext", { title: next.titleEn, round: `${next.nameEn} Round` }) : t("reportCard.goalDone")}
                </div>
              </div>
            </motion.div>
          </SahayikaPanel>

          <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-2xl font-bold">{r.playerName}</div>
                <div className="text-muted">{round ? `${round.nameEn} Round` : r.roundName} · {r.limitMinutes} min · {t("common.chanceOf", { n: r.chanceNo, max: r.maxChances })}</div>
                {r.autoSubmitted && <div className="text-sm text-timer-text font-semibold mt-1">⏱ {t("reportCard.autoSubmitted")}</div>}
                {r.roundKey === "trial" && r.trialPassed && <div className="text-sm text-success font-bold mt-1">🔓 {t("reportCard.trialUnlocked")}</div>}
                {r.sessionId && <div className="text-[11px] text-muted mt-1">{t("reportCard.sessionId")}: <span className="font-mono">{r.sessionId.slice(0, 8)}</span></div>}
              </div>
              <motion.div initial={{ scale: 0.5, rotate: 8 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 220, damping: 12 }}
                className="relative rounded-2xl bg-gradient-to-br from-primary-soft to-amber-50 border-2 border-orange-200 px-6 py-3 text-center">
                {r.chanceNo === r.bestChance && r.chanceNo > 1 && <span className="absolute -top-3 -right-3 rounded-full bg-gold text-navy text-xs font-extrabold px-2 py-0.5 shadow">{t("complete.newBest")}</span>}
                <div className="text-6xl font-extrabold text-primary tabular-nums leading-none"><CountUp to={r.score} onTick={() => sfx("tick")} /><span className="text-xl text-primary-strong"> / 100</span></div>
                <div className="text-sm font-semibold text-primary-strong mt-1">{t("reportCard.thisTime")}</div>
              </motion.div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {r.chances.map((s, i) => (
                <span key={i} className={`chip ${i + 1 === r.chanceNo ? "bg-primary-soft border-orange-300 text-primary-strong" : "bg-white border-gray-200 text-navy"}`}>
                  {s === null ? t("reportCard.chancePending", { n: i + 1 }) : t("reportCard.chanceScore", { n: i + 1, score: s })}
                  {r.bestChance === i + 1 && <span className="text-gold" title={t("reportCard.bestStar")}>★</span>}
                </span>
              ))}
            </div>
            <h3 className="mt-5 text-lg font-bold text-primary-strong">{t("reportCard.howYouDid")}</h3>
            <div className="mt-2 space-y-3">
              {bars(r).map(([ic, hi, sub, v, count], i) => (
                <motion.div key={hi} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.1 }} className="grid grid-cols-[1.6rem_7.5rem_1fr_auto] sm:grid-cols-[1.6rem_10rem_1fr_9rem] items-center gap-3">
                  <span aria-hidden>{ic}</span>
                  <div><div className="font-semibold">{hi}</div><div className="text-xs text-muted">{sub}</div></div>
                  <ProgressBar value={v} tone={i === 2 ? "orange" : "soft"} label={hi} />
                  <div className="text-right font-semibold tabular-nums">{count}</div>
                </motion.div>
              ))}
            </div>
            <div className="mt-5 space-y-2">
              <SahayikaLine line={r.tip} />
              {r.after.map((l) => <div key={l.id} className="text-[0.95rem] text-muted">💡 {lineText(l)}</div>)}
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link to={`/review/${r.attemptId}`} className="text-royal font-semibold underline">🔍 {t("reportCard.reviewOwn")}</Link>
              <Link to="/journey" className="text-muted font-semibold underline">🗺 {t("reportCard.map")}</Link>
              <span className="flex-1" />
              {r.chancesLeft > 0 && (r.roundKey === "trial" && !r.trialPassed
                ? <GameButton onClick={() => nav("/play/trial")}>↻ {t("reportCard.retryTrial", { n: r.chancesLeft })}</GameButton>
                : <GameButton variant="ghost" onClick={() => nav(`/play/${r.roundKey}`)}>↻ {t("reportCard.replay", { n: r.chancesLeft })}</GameButton>)}
              {!r.trialPassed ? null
                : next ? <GameButton sound="whoosh" onClick={() => nav(`/play/${next.key}`)}>{t("reportCard.nextRound", { roundName: `${next.nameEn} Round` })}</GameButton>
                  : <GameButton sound="fanfare" onClick={() => nav("/total")}>{t("reportCard.totalScore")}</GameButton>}
            </div>
          </motion.section>
        </div>
      </Page>
    </>
  );
}
