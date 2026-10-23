import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useNavigate } from "react-router-dom";
import { formatLimit } from "@hc/shared";
import { useConfig, useProgress } from "../lib/queries";
import { sfx } from "../lib/sfx";
import { roundName, t } from "../lib/strings";

const canHover = typeof window !== "undefined" && window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;
import { Coin, Header, Page, PageTitle, ProgressBar, Spinner, Stars } from "../components/Layout";
import { Ambient, GameButton, Medal } from "../components/Juice";
import { SahayikaAvatar } from "../components/SahayikaAvatar";

/** The level map: transparent progression from Level 1 to the final title. */
export function Journey() {
  const nav = useNavigate();
  const { data: cfg } = useConfig();
  const { data: prog } = useProgress();
  const s = prog?.summary;
  if (!cfg || !s) return <><Header /><Spinner /></>;
  const current = prog?.activeAttempt?.roundKey ?? s.nextRound ?? s.rounds.find((r) => r.unlocked && r.chancesLeft > 0)?.key ?? null;
  const q = s.trialQualifyingScore;
  const trial = s.rounds[0];
  const banner = s.trialPassed ? t("journey.unlockedAll")
    : trial.chancesLeft === 0 ? t("journey.trialLockedOut")
      : trial.played > 0 ? t("journey.trialRetry", { n: q, left: trial.chancesLeft }) : t("journey.trialFirst", { n: q });
  const open = (key: string) => {
    const r = s.rounds.find((x) => x.key === key)!;
    if (!r.playable) { sfx("whoosh"); nav(`/play/${key}`); return; } // Varchaspati: preview briefing
    if (!r.unlocked) { sfx("error"); return; }
    if (r.active && prog?.activeAttempt) return nav(`/round/${prog.activeAttempt.id}`);
    if (r.chancesLeft === 0) { sfx("error"); return; }
    sfx("whoosh");
    nav(`/play/${key}`);
  };
  return (
    <>
      <Header />
      <Ambient density={10} />
      <Page>
        <PageTitle hi={t("journey.heading")} en={t("journey.headingEn")}
          right={s.allPlayed && <GameButton sound="fanfare" onClick={() => nav("/total")}>🏆 {t("journey.hallOfFame")}</GameButton>} />
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} role="status"
          className={`mb-4 rounded-2xl px-4 py-3 font-semibold flex items-center gap-3 ${s.trialPassed ? "bg-success-soft text-green-900 border border-green-200" : "bg-primary-soft text-primary-strong border border-orange-200"}`}>
          <span className="text-xl" aria-hidden>{s.trialPassed ? "🔓" : "🎟"}</span>{banner}
        </motion.div>
        <div className="grid 2xl:grid-cols-[1fr_20rem] gap-6 items-start">
          {/* the trail */}
          <div className="relative card p-5 sm:p-8 overflow-hidden bg-gradient-to-br from-white via-cream/60 to-royal-soft/60">
            <svg className="absolute inset-0 w-full h-full hidden lg:block" viewBox="0 0 1000 420" preserveAspectRatio="none" aria-hidden>
              <motion.path d="M 40 330 C 140 330, 150 130, 250 140 S 380 320, 450 300 S 560 120, 650 130 S 760 320, 830 290 S 930 120, 980 110" fill="none" stroke="#FDBA74" strokeWidth="10" strokeLinecap="round" strokeDasharray="2 22"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.6, ease: "easeInOut" }} />
            </svg>
            <div className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-start">
              {cfg.rounds.map((r, i) => {
                const res = s.rounds[i];
                const preview = !res.playable;
                const locked = !res.unlocked && !preview;
                const here = r.key === current;
                const done = res.played > 0;
                return (
                  <motion.button key={r.key} type="button" onClick={() => open(r.key)}
                    initial={{ opacity: 0, y: 40, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 160, damping: 16, delay: 0.3 + i * 0.15 }}
                    whileHover={!canHover ? undefined : locked ? { x: [0, -4, 4, 0] } : { y: -8 }} whileTap={locked ? undefined : { scale: 0.96 }}
                    className={`relative text-left rounded-2xl border-2 p-4 shadow-card ${i % 2 ? "lg:mt-0" : "lg:mt-24"} ${preview ? "bg-gradient-to-br from-purple-50 to-white border-purple-300 border-dashed" : "bg-white"} ${here ? "border-primary ring-4 ring-primary/20" : done ? "border-green-300" : preview ? "" : "border-gray-100"} ${locked ? "opacity-75" : ""}`}
                    aria-label={`${r.levelLabel} ${roundName(r)}${locked ? `, ${t("journey.locked")}` : ""}`}>
                    {here && (
                      <motion.div className="absolute -top-12 left-1/2 -translate-x-1/2 flex flex-col items-center" animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 1.6 }}>
                        <span className="rounded-full bg-primary text-white text-[11px] font-extrabold px-2.5 py-0.5 whitespace-nowrap shadow-glow">{t("journey.youAreHere")}</span>
                        <SahayikaAvatar size={30} />
                      </motion.div>
                    )}
                    <div className="flex items-center gap-3 lg:flex-col lg:items-start lg:gap-2">
                      <Medal k={r.key} size={54} locked={locked} shine={res.titleEarned || preview} />
                      <div>
                        <div className="text-[11px] font-extrabold uppercase tracking-widest text-royal">{r.levelLabel}</div>
                        <div className="text-lg font-extrabold leading-tight">{roundName(r)}</div>
                        <div className="text-sm font-semibold text-primary-strong">{r.titleEn}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5 text-xs font-semibold [&>span]:px-2.5 [&>span]:py-1">
                      <span className="chip-plain">📄 {r.pages ? t("journey.pagesLabel", { n: r.pages }) : t("journey.wordsLabel", { n: cfg.levels?.trialWords?.min ?? 300 })}</span>
                      {!preview && <span className="chip-plain">⏱ {formatLimit(r.timeLimitMinutes)}</span>}
                      {!preview && <span className="chip-credit"><Coin size={13} />{r.creditCap}</span>}
                      {preview && <span className="chip bg-purple-100 border-purple-200 text-purple-800">{r.phase ?? t("journey.phase2")}</span>}
                      {!preview && <span className="chip-plain">{r.voiceTyping ? "🎤" : "⌨️"}</span>}
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div className={`flex gap-1 ${preview ? "invisible" : ""}`} aria-label={t("common.chanceOf", { n: res.chancesUsed, max: 3 })}>
                        {res.chances.map((c, k) => (
                          <span key={k} title={c === null ? "" : String(c)} className={`w-3.5 h-3.5 rounded-full border-2 ${c !== null ? (k + 1 === res.bestChance ? "bg-gold border-amber-600" : "bg-royal-bright border-royal") : k < res.chancesUsed ? "bg-blue-200 border-blue-300" : "bg-white border-gray-300"}`} />
                        ))}
                      </div>
                      {i === 0 && !preview ? <span className="text-[11px] font-bold text-royal">{t("journey.entry")}</span> : null}
                      {preview ? <span className="text-xs font-semibold text-purple-700">✨ {t("journey.comingSoon")}</span>
                        : locked ? <span className="text-xs font-semibold text-muted">🔒 {t("journey.locked")}</span>
                        : res.best !== null ? <span className="text-sm font-extrabold text-success">{t("journey.best", { n: res.best })}</span>
                          : null}
                    </div>
                    <div className={`mt-3 rounded-xl py-2 px-1 text-center font-extrabold text-[0.9rem] ${preview ? "bg-purple-600 text-white" : locked ? "bg-gray-100 text-muted" : res.active ? "bg-royal-bright text-white" : res.chancesLeft === 0 ? "bg-gray-100 text-muted" : "bg-primary text-white"}`}>
                      {preview ? `👀 ${t("journey.preview")}` : locked ? t("journey.lockedHint", { n: q }) : res.active ? `▶ ${t("journey.resume")}` : res.chancesLeft === 0 ? t("journey.noChances") : done ? `↻ ${t("journey.replay")}` : `▶ ${t("journey.play")}`}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>
          {/* stats */}
          <motion.aside initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }} className="card p-5 grid gap-6 md:grid-cols-3 2xl:grid-cols-1 2xl:gap-5 items-start">
            <div className="space-y-4">
            <h2 className="text-lg font-extrabold">{t("journey.stats")}</h2>
            <div>
              <div className="flex items-end justify-between mb-1.5"><span className="font-semibold text-muted">{t("journey.creditsMeter")}</span>
                <span className="text-3xl font-extrabold text-amber-600 tabular-nums">{s.totalCredits}<span className="text-base text-muted">/50</span></span></div>
              <ProgressBar value={s.totalCredits / 50} tone="gold" checkpoints={5} label={t("journey.creditsMeter")} />
            </div>
            <div className="flex items-center justify-between"><span className="font-semibold text-muted">{t("journey.statsStars")}</span><Stars n={s.stars} total={s.starsTotal} size={24} /></div>
            {s.allPlayed && <p className="text-sm font-semibold text-success">{t("journey.allDone")}</p>}
            </div>
            <div>
              <div className="font-semibold text-muted mb-2">{t("journey.titles")}</div>
              <div className="grid grid-cols-2 gap-3">
                {cfg.rounds.filter((r) => r.playable !== false).map((r, i) => (
                  <div key={r.key} className={`rounded-xl border p-2 text-center ${s.rounds[i].titleEarned ? "border-amber-200 bg-amber-50" : "border-gray-100"}`}>
                    <div className="flex justify-center"><Medal k={r.key} size={44} locked={!s.rounds[i].titleEarned} /></div>
                    <div className="text-xs font-bold mt-1">{r.titleEn}</div>
                    <div className="text-[11px] text-muted">{s.rounds[i].titleEarned ? r.titleMeaning : t("journey.titleLocked")}</div>
                  </div>
                ))}
              </div>
            </div>
            <Leaderboard />
          </motion.aside>
        </div>
      </Page>
    </>
  );
}

interface Board { top: { rank: number; name: string; office: string; credits: number; stars: number; titles: number; me: boolean }[]; me: { rank: number; credits: number; of: number } | null }

/** Leaderboard: top 10 by credits, with the player's own rank. */
function Leaderboard() {
  const { data } = useQuery({ queryKey: ["leaderboard"], queryFn: () => api<Board>("/leaderboard"), staleTime: 30_000 });
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-muted">🏅 {t("journey.leaderboard")}</span>
        {data?.me && <span className="text-xs font-bold text-royal">{t("journey.yourRank", { rank: data.me.rank, of: data.me.of })}</span>}
      </div>
      {!data?.top.length ? <p className="text-sm text-muted">{t("journey.leaderEmpty")}</p> : (
        <ol className="space-y-1">
          {data.top.map((r) => (
            <li key={r.rank} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${r.me ? "bg-primary-soft font-bold" : ""}`}>
              <span className={`w-6 text-center font-extrabold ${r.rank <= 3 ? "text-amber-600" : "text-muted"}`}>{r.rank <= 3 ? ["🥇", "🥈", "🥉"][r.rank - 1] : r.rank}</span>
              <span className="flex-1 min-w-0"><span className="block truncate">{r.name}</span><span className="block text-[11px] text-muted truncate">{r.office}</span></span>
              <span className="font-extrabold tabular-nums text-amber-700">{r.credits}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
