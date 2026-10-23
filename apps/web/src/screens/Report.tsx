import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { usePrefs } from "../lib/store";
import { t } from "../lib/strings";
import type { Line } from "../lib/voice";
import { Confetti, Header, Page, PageTitle, ProgressBar, Spinner, Stars } from "../components/Layout";
import { SahayikaLine, SahayikaPanel, useAutoSpeak } from "../components/Sahayika";

export interface ReportData {
  attemptId: string; roundKey: string; roundName: string; title: string; limitMinutes: number; chanceNo: number; maxChances: number;
  playerName: string; score: number; autoSubmitted: boolean;
  counts: { translation10: number; sentence10: number; completionDone: number; completionTotal: number; completionUnit: "sentence" | "paragraph"; glossaryCorrect: number; glossaryTotal: number; usedMinutes: number; limitMinutes: number };
  measures: { translation: number; completion: number; sentence: number; glossary: number; time: number };
  best: number; chances: (number | null)[]; bestChance: number | null; titleEarned: boolean; roundCredits: number; totalCredits: number; maxCredits: number;
  stars: number; starsTotal: number; chancesLeft: number; leftCount: number;
  announce: Line[]; titleNeeded: Line | null; tip: Line; after: Line[];
  nextRound: { key: string; name: string; unlocked: boolean } | null;
}

function useCountUp(target: number, ms = 1200) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

/** §7.7 Report card — designs 06, 09, 11, 13. */
export function Report() {
  const { id = "" } = useParams();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const unlocked = usePrefs((s) => s.unlocked);
  const { data: r } = useQuery({ queryKey: ["report", id], queryFn: () => api<ReportData>(`/attempts/${id}/report`) });
  const shown = useCountUp(r?.score ?? 0);
  // Sahayika announces: opening line, the title, then the credits line (§10.3)
  useAutoSpeak(r ? { id: "report", en: r.announce.map((l) => l.en).join(" "), hi: "" } : null, unlocked);
  if (!r) return <><Header /><Spinner /></>;
  const c = r.counts;
  const bars: [string, string, number, string][] = [
    [t("reportCard.measureTranslation"), "Translation", r.measures.translation, t("reportCard.marksOf10", { n: c.translation10 })],
    [t("reportCard.measureTime"), "Time taken", r.measures.time, t("reportCard.timeMin", { used: c.usedMinutes, limit: c.limitMinutes })],
    [t("reportCard.measureCompletion"), c.completionUnit === "sentence" ? "Sentences done" : "Paragraphs done", r.measures.completion,
      c.completionUnit === "sentence" ? t("reportCard.sentencesOf", { n: c.completionDone, total: c.completionTotal }) : t("reportCard.paragraphsOf", { n: c.completionDone, total: c.completionTotal })],
    [t("reportCard.measureGlossary"), "Glossary words used", r.measures.glossary, t("reportCard.wordsOf", { n: c.glossaryCorrect, total: c.glossaryTotal })],
    [t("reportCard.measureSentence"), "Sentence construction", r.measures.sentence, t("reportCard.marksOf10", { n: c.sentence10 })],
  ];
  const isLast = !r.nextRound;
  return (
    <>
      <Header />
      <Confetti run={r.titleEarned && r.score === r.best} />
      <Page>
        <PageTitle hi={t("reportCard.heading", { roundName: r.roundName })} en={t("reportCard.headingEn")} right={<span className="chip-plain text-base">{t("common.chanceOf", { n: r.chanceNo, max: r.maxChances })}</span>} />
        <div className="grid lg:grid-cols-[1fr_1.35fr] gap-6">
          <SahayikaPanel lines={r.announce.slice(0, 1)} autoSpeak={false} title={t("reportCard.sahayikaAnnounces")}>
            {r.titleEarned ? (
              <div className="rounded-full bg-primary text-white text-center py-5 text-4xl font-bold shadow-glow animate-pop ring-4 ring-white/30">{r.title}</div>
            ) : (
              <div className="rounded-card bg-white/10 border border-white/30 text-center py-4 px-3 text-[17px]">{r.titleNeeded?.hi}</div>
            )}
            {r.announce.slice(2).map((l) => <p key={l.id} className="text-[16px] text-white/90">{l.hi}</p>)}
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-full bg-primary-strong px-5 py-2 text-xl font-bold shadow-glow animate-pop">{t("reportCard.creditsEarned", { n: r.roundCredits })}</span>
              <span className="text-xl font-bold">{t("reportCard.runningTotal", { n: r.totalCredits })}</span>
            </div>
            <div className="flex items-center justify-between">
              <Stars n={r.stars} total={r.starsTotal} size={34} animate />
              <span className="text-sm text-blue-100">{t("reportCard.starsLabel")}</span>
            </div>
          </SahayikaPanel>

          <section className="card p-5 sm:p-6 animate-rise">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-2xl font-bold">{r.playerName}</div>
                <div className="text-muted">{r.roundName} · <span className="en">{r.limitMinutes} min</span> · {t("common.chanceOf", { n: r.chanceNo, max: r.maxChances })}</div>
                {r.autoSubmitted && <div className="text-sm text-timer-text font-semibold mt-1">⏱ {t("reportCard.autoSubmitted")}</div>}
              </div>
              <div className="rounded-card bg-primary-soft border border-orange-200 px-5 py-3 text-center">
                <div className="text-5xl font-bold text-primary tabular-nums">{shown}<span className="text-xl text-primary-strong"> / 100</span></div>
                <div className="text-sm font-semibold text-primary-strong">{t("reportCard.thisTime")}</div>
              </div>
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
              {bars.map(([hi, en, v, count], i) => (
                <div key={hi} className="grid grid-cols-[8.5rem_1fr_auto] sm:grid-cols-[10rem_1fr_9rem] items-center gap-3">
                  <div><div className="font-semibold">{hi}</div><div className="en text-xs text-muted">{en}</div></div>
                  <ProgressBar value={v} tone={i === 2 ? "orange" : "soft"} label={hi} />
                  <div className="text-right font-semibold tabular-nums">{count}</div>
                </div>
              ))}
            </div>
            <div className="mt-5 space-y-2">
              <SahayikaLine line={r.tip} autoSpeak={false} />
              {r.after.map((l) => <div key={l.id} className="text-[15px] text-muted">{l.hi}</div>)}
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link to={`/review/${r.attemptId}`} className="text-royal font-semibold underline">{t("reportCard.reviewOwn")} →</Link>
              <span className="flex-1" />
              {r.chancesLeft > 0 && <button className="btn-ghost" onClick={() => nav(`/play/${r.roundKey}`)}>{t("reportCard.replay", { n: r.chancesLeft })}</button>}
              {isLast ? <button className="btn-primary" onClick={() => nav("/total")}>{t("reportCard.totalScore")}</button>
                : <button className="btn-primary" onClick={() => nav(`/play/${r.nextRound!.key}`)}>{t("reportCard.nextRound", { roundName: r.nextRound!.name })}</button>}
            </div>
            {sp.get("auto") && <div className="sr-only" aria-live="polite">{t("round.timeUp")}</div>}
          </section>
        </div>
      </Page>
    </>
  );
}
