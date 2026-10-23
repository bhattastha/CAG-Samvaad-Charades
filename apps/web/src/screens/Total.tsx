import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { Summary } from "@hc/shared";
import { api } from "../lib/api";
import { useConfig } from "../lib/queries";
import { sfx } from "../lib/sfx";
import { lineText, t } from "../lib/strings";
import type { Line } from "../lib/voice";
import { Coin, Confetti, Header, Page, PageTitle, ProgressBar, Spinner, Stars } from "../components/Layout";
import { SahayikaPanel } from "../components/Sahayika";
import { Ambient, CountUp, GameButton, Medal } from "../components/Juice";

/** §7.8 Total score — design 14, as a Hall of Fame. */
export function Total() {
  const nav = useNavigate();
  const { data: cfg } = useConfig();
  const { data } = useQuery({ queryKey: ["summary"], queryFn: () => api<{ playerName: string; summary: Summary; maxCredits: number; lines: Line[] }>("/me/summary") });
  const [picker, setPicker] = useState(false);
  useEffect(() => { if (data) setTimeout(() => sfx("fanfare"), 300); }, [!!data]);
  if (!data || !cfg) return <><Header /><Spinner /></>;
  const s = data.summary;
  const replayable = s.rounds.filter((r) => r.unlocked && r.chancesLeft > 0);
  const note = data.lines.find((l) => l.id === "end.screen.replay_note");
  const said = data.lines.filter((l) => l.id !== "end.screen.replay_note");
  return (
    <>
      <Header />
      <Ambient density={14} />
      <Confetti run={s.rounds.every((r) => r.titleEarned)} />
      <Page>
        <PageTitle hi={t("total.heading")} en={t("total.headingEn")} right={<GameButton variant="ghost" onClick={() => nav("/journey")}>🗺 {t("reportCard.map")}</GameButton>} />
        <div className="grid lg:grid-cols-[1fr_1.15fr] gap-6">
          <motion.section initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="sahayika-panel p-6 sm:p-8 relative overflow-hidden text-center">
            <motion.div initial={{ y: -60, opacity: 0, rotate: -20 }} animate={{ y: 0, opacity: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 120, damping: 10, delay: 0.2 }} className="text-7xl" aria-hidden>🏆</motion.div>
            <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold">{t("total.congrats", { name: data.playerName })}</h2>
            <div className="mt-3 flex items-center justify-center gap-3">
              <Coin size={48} />
              <span className="text-7xl font-extrabold text-amber-300 tabular-nums"><CountUp to={s.totalCredits} decimals={1} duration={1.8} onTick={() => sfx("coin")} /></span>
              <span className="text-2xl">/ {data.maxCredits}</span>
            </div>
            <div className="mt-3 max-w-xs mx-auto"><ProgressBar value={s.totalCredits / data.maxCredits} tone="gold" checkpoints={5} /></div>
            <div className="mt-4 flex justify-center"><Stars n={s.stars} total={s.starsTotal} size={34} animate /></div>
            <p className="mt-4 text-[1.05rem]">{t("total.useCredits")}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <a className="btn-primary" href="/api/me/certificate?format=pdf" onClick={() => sfx("coin")}>📜 {t("total.download")}</a>
              {replayable.length > 0 && <GameButton variant="light" onClick={() => setPicker(true)}>↑ {t("total.improve")}</GameButton>}
            </div>
            {note && <p className="mt-3 text-sm text-blue-100">{lineText(note)}</p>}
          </motion.section>

          <div className="space-y-5">
            <div className="card p-5">
              <h3 className="font-extrabold mb-3">{t("journey.titles")}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {cfg.rounds.map((r, i) => (
                  <motion.div key={r.key} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.12 }}
                    className={`rounded-xl border p-3 text-center ${s.rounds[i].titleEarned ? "border-amber-200 bg-amber-50" : "border-gray-100"}`}>
                    <div className="flex justify-center"><Medal k={r.key} size={56} locked={!s.rounds[i].titleEarned} shine={s.rounds[i].titleEarned} /></div>
                    <div className="mt-1 text-sm font-extrabold">{r.titleEn}</div>
                    <div className="text-[11px] text-muted">{s.rounds[i].titleEarned ? r.titleMeaning : t("journey.titleLocked")}</div>
                  </motion.div>
                ))}
              </div>
            </div>
            <section className="card p-4 sm:p-5">
              <table className="w-full">
                <thead><tr className="text-sm text-muted text-left"><th className="pb-2">{t("total.colRound")}</th><th className="pb-2 text-center">{t("total.colBest")}</th><th className="pb-2 text-right">{t("total.colCredits")}</th></tr></thead>
                <tbody>
                  <tr className="border-t border-gray-100"><td className="py-2.5 font-bold">🎟 {t("total.registration")}</td><td /><td className="text-right font-extrabold text-amber-700">+{s.registrationCredits}</td></tr>
                  {s.rounds.map((r, i) => (
                    <tr key={r.key} className="border-t border-gray-100">
                      <td className="py-2.5"><span className="font-bold">{cfg.rounds[i].nameEn} Round</span><div className={`text-sm ${r.titleEarned ? "text-primary-strong font-semibold" : "text-muted"}`}>{cfg.rounds[i].titleEn}{r.titleEarned ? " ✓" : ""}</div></td>
                      <td className="text-center"><span className="font-bold tabular-nums">{r.best ?? "—"} / 100</span><div className="text-xs text-muted">{t("total.chancesUsed", { n: r.chancesUsed })}</div></td>
                      <td className="text-right font-extrabold text-amber-700">+{r.credits}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-gray-200"><td className="pt-3 text-xl font-extrabold">{t("total.totalCredits")}</td><td /><td className="pt-3 text-right text-2xl font-extrabold tabular-nums">{s.totalCredits}</td></tr>
                </tbody>
              </table>
              <p className="mt-2 text-sm text-muted">{t("total.bestAdded")}</p>
            </section>
            <SahayikaPanel lines={said} />
          </div>
        </div>
      </Page>
      <AnimatePresence>
        {picker && (
          <motion.div className="fixed inset-0 z-[80] bg-navy/40 grid place-items-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPicker(false)}>
            <motion.div initial={{ scale: 0.85, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }} className="card w-full max-w-md p-5" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
              <h2 className="text-xl font-bold text-primary">{t("total.pickRound")}</h2>
              <div className="mt-3 space-y-2">
                {replayable.length === 0 && <p className="text-muted">{t("total.nothingToReplay")}</p>}
                {replayable.map((r) => {
                  const rc = cfg.rounds.find((x) => x.key === r.key)!;
                  return (
                    <motion.button key={r.key} whileHover={{ x: 4 }} whileTap={{ scale: 0.97 }} onClick={() => { sfx("whoosh"); nav(`/play/${r.key}`); }}
                      className="w-full text-left rounded-xl border-2 border-gray-200 hover:border-primary px-4 py-3 flex items-center gap-3">
                      <Medal k={r.key} size={40} locked={!r.titleEarned} />
                      <span className="flex-1"><span className="font-bold">{rc.nameEn} Round</span> <span className="text-sm text-muted">· {t("journey.best", { n: r.best ?? "—" })}</span></span>
                      <span className="text-sm font-semibold text-primary-strong">{t("reportCard.replay", { n: r.chancesLeft })}</span>
                    </motion.button>
                  );
                })}
              </div>
              <button className="mt-4 text-muted underline" onClick={() => setPicker(false)}>{t("common.close")}</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
