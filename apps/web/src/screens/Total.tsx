import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { Summary } from "@hc/shared";
import { api } from "../lib/api";
import { usePrefs } from "../lib/store";
import { t } from "../lib/strings";
import type { Line } from "../lib/voice";
import { Confetti, Header, Page, PageTitle, Spinner, Stars } from "../components/Layout";
import { SahayikaLine, useAutoSpeak } from "../components/Sahayika";

/** §7.8 Total score — design 14. */
export function Total() {
  const nav = useNavigate();
  const unlocked = usePrefs((s) => s.unlocked);
  const { data } = useQuery({ queryKey: ["summary"], queryFn: () => api<{ playerName: string; summary: Summary; maxCredits: number; lines: Line[] }>("/me/summary") });
  const [picker, setPicker] = useState(false);
  useAutoSpeak(data ? { id: "total", en: data.lines.filter((l) => l.spoken !== false).map((l) => l.en).join(" "), hi: "" } : null, unlocked);
  if (!data) return <><Header /><Spinner /></>;
  const s = data.summary;
  const replayable = s.rounds.filter((r) => r.unlocked && r.chancesLeft > 0);
  const main = data.lines.find((l) => l.id !== "end.screen.total_open" && l.id !== "end.screen.replay_note") ?? data.lines[0];
  const note = data.lines.find((l) => l.id === "end.screen.replay_note");
  return (
    <>
      <Header />
      <Confetti run={s.rounds.every((r) => r.titleEarned)} />
      <Page>
        <PageTitle hi={t("total.heading")} en={t("total.headingEn")} />
        <div className="grid lg:grid-cols-[1.3fr_1fr] gap-6">
          <section className="card p-4 sm:p-6 animate-rise">
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 text-sm text-muted px-2 pb-2 border-b border-gray-100">
              <span className="pl-9">{t("total.colRound")}</span><span className="text-center w-28">{t("total.colBest")}</span><span className="text-right w-16">{t("total.colCredits")}</span>
            </div>
            <ul>
              <li className="grid grid-cols-[1fr_auto_auto] gap-x-4 items-center px-2 py-3 border-b border-gray-100">
                <span className="flex items-center gap-3"><Tick on /><span className="font-bold text-lg">{t("total.registration")}</span></span>
                <span className="w-28" /><span className="w-16 text-right font-bold text-primary-strong text-lg">+{s.registrationCredits}</span>
              </li>
              {s.rounds.map((r) => (
                <li key={r.key} className="grid grid-cols-[1fr_auto_auto] gap-x-4 items-center px-2 py-3 border-b border-gray-100">
                  <span className="flex items-center gap-3"><Tick on={r.titleEarned} />
                    <span><span className="block font-bold text-lg">{r.name}</span><span className={`text-sm ${r.titleEarned ? "text-primary-strong font-semibold" : "text-muted"}`}>{r.title}{!r.titleEarned && r.best !== null ? " 🔒" : ""}</span></span>
                  </span>
                  <span className="w-28 text-center"><span className="block font-bold tabular-nums">{r.best ?? "—"} / 100</span><span className="text-xs text-muted">{t("total.chancesUsed", { n: r.chancesUsed })}</span></span>
                  <span className="w-16 text-right font-bold text-primary-strong text-lg">+{r.credits}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 rounded-card bg-gray-50 px-4 py-4 flex items-center justify-between">
              <span className="text-2xl font-bold">{t("total.totalCredits")}</span><span className="text-3xl font-bold tabular-nums">{s.totalCredits}</span>
            </div>
            <p className="mt-2 text-sm text-muted">{t("total.bestAdded")}</p>
          </section>

          <section className="sahayika-panel p-6 flex flex-col gap-4 animate-rise">
            <div className="flex items-start justify-between">
              <h2 className="text-2xl font-bold">{t("total.congrats", { name: data.playerName })}</h2>
              <span className="text-5xl animate-float" aria-hidden>🏆</span>
            </div>
            <div><span className="text-7xl font-bold text-orange-300 tabular-nums">{s.totalCredits}</span><span className="text-2xl"> / {data.maxCredits} {t("ui.credits")}</span></div>
            <Stars n={s.stars} total={s.starsTotal} size={30} animate />
            <p className="text-[17px]">{t("total.useCredits")}</p>
            <SahayikaLine line={main} tone="cream" autoSpeak={false} />
            <div className="flex flex-wrap gap-3">
              <a className="btn-primary" href="/api/me/certificate?format=pdf">{t("total.download")}</a>
              {replayable.length > 0 && <button className="btn bg-transparent text-white border-2 border-white/80 hover:bg-white/10" onClick={() => setPicker(true)}>{t("total.improve")}</button>}
            </div>
            {note && <p className="text-sm text-blue-100">{note.hi}</p>}
          </section>
        </div>
      </Page>
      {picker && (
        <div className="fixed inset-0 z-[80] bg-navy/40 grid place-items-center p-4" onClick={() => setPicker(false)}>
          <div className="card w-full max-w-md p-5 animate-pop" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <h2 className="text-xl font-bold text-primary">{t("ui.pickRound")}</h2>
            <div className="mt-3 space-y-2">
              {replayable.length === 0 && <p className="text-muted">{t("ui.nothingToReplay")}</p>}
              {replayable.map((r) => (
                <button key={r.key} onClick={() => nav(`/play/${r.key}`)} className="w-full text-left rounded-xl border-2 border-gray-200 hover:border-primary px-4 py-3 flex items-center justify-between">
                  <span><span className="font-bold">{r.name}</span> <span className="text-sm text-muted">· {t("ui.levelBest", { n: r.best ?? "—" })}</span></span>
                  <span className="text-sm font-semibold text-primary-strong">{t("reportCard.replay", { n: r.chancesLeft })}</span>
                </button>
              ))}
            </div>
            <button className="mt-4 text-muted underline" onClick={() => setPicker(false)}>{t("ui.close")}</button>
          </div>
        </div>
      )}
    </>
  );
}

function Tick({ on }: { on: boolean }) {
  return <span className={`w-7 h-7 rounded-full grid place-items-center text-white font-bold ${on ? "bg-primary" : "bg-gray-200"}`}>{on ? "✓" : ""}</span>;
}
