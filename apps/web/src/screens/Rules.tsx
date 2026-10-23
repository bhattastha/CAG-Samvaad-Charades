import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatLimit } from "@hc/shared";
import { lineById, useConfig, useLines, useProgress } from "../lib/queries";
import { t } from "../lib/strings";
import { Header, Page, PageTitle, Stars } from "../components/Layout";
import { SahayikaLine } from "../components/Sahayika";
import { CreditPills } from "./HowToPlay";

const RoundIcon = ({ k }: { k: string }) => <span aria-hidden className="text-2xl">{({ trial: "🌱", primary: "📄", secondary: "📊", pro: "🏆" } as Record<string, string>)[k]}</span>;

/** §7.4 Rules — design 04; the round cards double as the level map. */
export function Rules() {
  const nav = useNavigate();
  const { data: cfg } = useConfig();
  const { data: prog } = useProgress();
  const { data: lines } = useLines("before_game");
  const [second, setSecond] = useState(false);
  useEffect(() => { const tm = setTimeout(() => setSecond(true), 6500); return () => clearTimeout(tm); }, []);
  const s = prog?.summary;
  const current = prog?.activeAttempt?.roundKey ?? s?.nextRound ?? s?.rounds.find((r) => r.unlocked && r.chancesLeft > 0)?.key ?? "trial";
  const go = () => {
    if (prog?.activeAttempt) return nav(`/round/${prog.activeAttempt.id}`);
    if (!s?.rounds.some((r) => r.chancesLeft > 0 && r.unlocked)) return nav("/total");
    nav(`/play/${current}`);
  };
  return (
    <>
      <Header />
      <Page>
        <PageTitle hi={t("rules.heading")} en="Rules" right={<button className="btn-primary" onClick={go}>{t("rules.start")} <span aria-hidden>→</span></button>} />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cfg?.rounds.map((r, i) => {
            const res = s?.rounds.find((x) => x.key === r.key);
            const locked = res ? !res.unlocked : i > 0;
            const isCurrent = r.key === current;
            return (
              <button key={r.key} disabled={locked || !res || (res.chancesLeft === 0 && !res.active)} onClick={() => nav(res?.active && prog?.activeAttempt ? `/round/${prog.activeAttempt.id}` : `/play/${r.key}`)}
                className={`card text-left p-4 sm:p-5 relative transition hover:-translate-y-0.5 disabled:hover:translate-y-0 animate-rise ${isCurrent ? "ring-2 ring-primary border-primary" : ""} ${locked ? "opacity-70" : ""}`}
                style={{ animationDelay: `${i * 80}ms` }}>
                {locked && <span className="absolute top-3 right-3 text-xl" title={t("ui.levelLocked")}>🔒</span>}
                {res?.titleEarned && <span className="absolute top-3 right-3 text-xl">🏅</span>}
                <div className="flex items-center gap-2"><RoundIcon k={r.key} /><h2 className="text-xl font-bold">{r.name}</h2></div>
                <div className="text-sm font-semibold text-primary-strong mt-0.5">{r.title}</div>
                <div className="flex items-center gap-2 mt-3 text-3xl font-bold text-navy"><span className="text-primary">⏱</span><span className="en">{formatLimit(r.timeLimitMinutes)}</span></div>
                <div className="mt-3 space-y-1.5 text-[15px]">
                  <div>{r.voiceTyping ? "🎤 " + t("rules.cardVoiceOrType") : "⌨️ " + t("rules.cardTypeOnly")}</div>
                  <div>📋 {r.completionCountedBy === "sentence" ? t("rules.cardEachSentence") : t("rules.cardEachParagraph")}</div>
                  <div className="text-muted">{t("rules.cardCredits", { n: r.creditCap })}</div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-sm">
                  {locked ? <span className="text-muted">{t("ui.levelLocked")}</span>
                    : res && res.best !== null ? <span className="font-semibold text-success">{t("ui.levelBest", { n: res.best })}</span>
                      : <span className="font-bold text-primary-strong">{t("ui.levelNow")} →</span>}
                  {res && <span className="text-muted en">{res.chancesUsed}/3</span>}
                </div>
              </button>
            );
          })}
        </div>
        <div className="mt-5 grid md:grid-cols-[1fr_auto] gap-4 items-center">
          <SahayikaLine line={lineById(lines, second ? "before_game.screen.rules_credits" : "before_game.screen.rules_open")} tone="white" />
          <div className="card px-4 py-3 flex items-center gap-3"><CreditPills />{s && <Stars n={s.stars} total={s.starsTotal} size={20} />}</div>
        </div>
        <div className="mt-5 grid md:grid-cols-3 gap-4">
          {[["🔒", "rules.rule1", "rules.rule1Body"], ["🔁", "rules.rule2", "rules.rule2Body"], ["⌨️", "rules.rule3", "rules.rule3Body"]].map(([ic, h, b], i) => (
            <div key={h} className="rounded-card bg-cream border border-orange-100 p-5 animate-rise" style={{ animationDelay: `${300 + i * 80}ms` }}>
              <div className="flex items-center gap-2 text-lg font-bold"><span className="w-9 h-9 rounded-full bg-primary text-white grid place-items-center">{ic}</span>{t(h)}</div>
              <p className="mt-2 text-[16px] leading-relaxed">{t(b)}</p>
            </div>
          ))}
        </div>
      </Page>
    </>
  );
}
