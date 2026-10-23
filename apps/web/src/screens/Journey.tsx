import { motion } from "framer-motion";
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
  const open = (key: string) => {
    const r = s.rounds.find((x) => x.key === key)!;
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
        <div className="grid xl:grid-cols-[1fr_20rem] gap-6 items-start">
          {/* the trail */}
          <div className="relative card p-5 sm:p-8 overflow-hidden bg-gradient-to-br from-white via-cream/60 to-royal-soft/60">
            <svg className="absolute inset-0 w-full h-full hidden lg:block" viewBox="0 0 1000 420" preserveAspectRatio="none" aria-hidden>
              <motion.path d="M 60 330 C 200 330, 220 120, 370 140 S 560 330, 640 300 S 820 90, 950 110" fill="none" stroke="#FDBA74" strokeWidth="10" strokeLinecap="round" strokeDasharray="2 22"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.6, ease: "easeInOut" }} />
            </svg>
            <div className="relative grid gap-5 lg:grid-cols-4 lg:items-start">
              {cfg.rounds.map((r, i) => {
                const res = s.rounds[i];
                const locked = !res.unlocked;
                const here = r.key === current;
                const done = res.played > 0;
                return (
                  <motion.button key={r.key} type="button" onClick={() => open(r.key)}
                    initial={{ opacity: 0, y: 40, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 160, damping: 16, delay: 0.3 + i * 0.15 }}
                    whileHover={!canHover ? undefined : locked ? { x: [0, -4, 4, 0] } : { y: -8 }} whileTap={locked ? undefined : { scale: 0.96 }}
                    className={`relative text-left rounded-2xl border-2 bg-white p-4 shadow-card ${i % 2 ? "lg:mt-0" : "lg:mt-24"} ${here ? "border-primary ring-4 ring-primary/20" : done ? "border-green-300" : "border-gray-100"} ${locked ? "opacity-75" : ""}`}
                    aria-label={`${r.levelLabel} ${roundName(r)}${locked ? `, ${t("journey.locked")}` : ""}`}>
                    {here && (
                      <motion.div className="absolute -top-12 left-1/2 -translate-x-1/2 flex flex-col items-center" animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 1.6 }}>
                        <span className="rounded-full bg-primary text-white text-[11px] font-extrabold px-2.5 py-0.5 whitespace-nowrap shadow-glow">{t("journey.youAreHere")}</span>
                        <SahayikaAvatar size={30} />
                      </motion.div>
                    )}
                    <div className="flex items-center gap-3">
                      <Medal k={r.key} size={58} locked={locked} shine={res.titleEarned} />
                      <div>
                        <div className="text-[11px] font-extrabold uppercase tracking-widest text-royal">{r.levelLabel}</div>
                        <div className="text-lg font-extrabold leading-tight">{roundName(r)}</div>
                        <div className="text-sm font-semibold text-primary-strong">{r.titleEn}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5 text-xs font-semibold">
                      <span className="chip-plain">⏱ {formatLimit(r.timeLimitMinutes)}</span>
                      <span className="chip-credit"><Coin size={13} />{r.creditCap}</span>
                      <span className="chip-plain">{r.voiceTyping ? "🎤" : "⌨️"}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex gap-1" aria-label={t("common.chanceOf", { n: res.chancesUsed, max: 3 })}>
                        {res.chances.map((c, k) => (
                          <span key={k} title={c === null ? "" : String(c)} className={`w-3.5 h-3.5 rounded-full border-2 ${c !== null ? (k + 1 === res.bestChance ? "bg-gold border-amber-600" : "bg-royal-bright border-royal") : k < res.chancesUsed ? "bg-blue-200 border-blue-300" : "bg-white border-gray-300"}`} />
                        ))}
                      </div>
                      {locked ? <span className="text-xs font-semibold text-muted">🔒 {t("journey.locked")}</span>
                        : res.best !== null ? <span className="text-sm font-extrabold text-success">{t("journey.best", { n: res.best })}</span>
                          : null}
                    </div>
                    <div className={`mt-3 rounded-xl py-2 text-center font-extrabold text-[0.95rem] ${locked ? "bg-gray-100 text-muted" : res.active ? "bg-royal-bright text-white" : res.chancesLeft === 0 ? "bg-gray-100 text-muted" : "bg-primary text-white"}`}>
                      {locked ? t("journey.lockedHint") : res.active ? `▶ ${t("journey.resume")}` : res.chancesLeft === 0 ? t("journey.noChances") : done ? `↻ ${t("journey.replay")}` : `▶ ${t("journey.play")}`}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>
          {/* stats */}
          <motion.aside initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }} className="card p-5 space-y-5">
            <h2 className="text-lg font-extrabold">{t("journey.stats")}</h2>
            <div>
              <div className="flex items-end justify-between mb-1.5"><span className="font-semibold text-muted">{t("journey.creditsMeter")}</span>
                <span className="text-3xl font-extrabold text-amber-600 tabular-nums">{s.totalCredits}<span className="text-base text-muted">/50</span></span></div>
              <ProgressBar value={s.totalCredits / 50} tone="gold" checkpoints={5} label={t("journey.creditsMeter")} />
            </div>
            <div className="flex items-center justify-between"><span className="font-semibold text-muted">{t("journey.statsStars")}</span><Stars n={s.stars} total={s.starsTotal} size={24} /></div>
            <div>
              <div className="font-semibold text-muted mb-2">{t("journey.titles")}</div>
              <div className="grid grid-cols-2 gap-3">
                {cfg.rounds.map((r, i) => (
                  <div key={r.key} className={`rounded-xl border p-2 text-center ${s.rounds[i].titleEarned ? "border-amber-200 bg-amber-50" : "border-gray-100"}`}>
                    <div className="flex justify-center"><Medal k={r.key} size={44} locked={!s.rounds[i].titleEarned} /></div>
                    <div className="text-xs font-bold mt-1">{r.titleEn}</div>
                    <div className="text-[11px] text-muted">{s.rounds[i].titleEarned ? r.titleMeaning : t("journey.titleLocked")}</div>
                  </div>
                ))}
              </div>
            </div>
            {s.allPlayed && <p className="text-sm font-semibold text-success">{t("journey.allDone")}</p>}
          </motion.aside>
        </div>
      </Page>
    </>
  );
}
