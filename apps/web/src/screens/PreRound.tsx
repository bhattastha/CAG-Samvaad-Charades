import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatLimit, type RoundConfig } from "@hc/shared";
import { api, ApiError, clientId } from "../lib/api";
import { sfx } from "../lib/sfx";
import { usePrefs } from "../lib/store";
import { roundName, t } from "../lib/strings";
import type { Line } from "../lib/voice";
import { Coin, Header, Page, Spinner } from "../components/Layout";
import { SahayikaLine } from "../components/Sahayika";
import { Ambient, Countdown, GameButton, Medal } from "../components/Juice";
import { micCheck } from "../editor/voice";

interface Intro { round: RoundConfig; chance: number; maxChances: number; unlocked: boolean; chancesLeft: number; active: boolean; best: number | null; lines: Line[] }

export async function enterFullscreen() {
  const el: any = document.documentElement;
  try {
    if (!document.fullscreenElement) await (el.requestFullscreen?.({ navigationUI: "hide" }) ?? el.webkitRequestFullscreen?.());
  } catch { /* iPhone Safari: no element fullscreen; visibility tracking covers it (§12) */ }
}

/** Mic check before the clock starts (Level 1 only, §15.1). */
function MicCheck() {
  const [state, setState] = useState<"idle" | "on" | "ok" | "denied">("idle");
  const [level, setLevel] = useState(0);
  const stop = useRef<(() => void) | null>(null);
  useEffect(() => () => stop.current?.(), []);
  const start = async () => {
    try {
      stop.current = await micCheck((v) => { setLevel(v); if (v > 0.12) setState((s) => { if (s !== "ok") sfx("success"); return "ok"; }); });
      setState((s) => (s === "ok" ? s : "on"));
    } catch { setState("denied"); sfx("error"); }
  };
  return (
    <div className="rounded-card border-2 border-dashed border-blue-200 bg-royal-soft/50 p-3.5 flex items-center gap-3 flex-wrap">
      <span className="text-2xl" aria-hidden>🎤</span>
      {state === "idle" && <GameButton type="button" variant="blue" onClick={start} className="py-2 text-base">{t("preRound.micStart")}</GameButton>}
      {(state === "on" || state === "ok") && (
        <div className="flex-1 min-w-[12rem]">
          <div className="text-sm font-semibold">{state === "ok" ? "✅ " + t("preRound.micOk") : t("round.micCheck")}</div>
          <div className="mt-1 flex gap-[3px] h-5 items-end">
            {Array.from({ length: 18 }, (_, i) => <span key={i} className={`flex-1 rounded-sm transition-all duration-75 ${level * 18 * 2.2 > i ? (i > 13 ? "bg-primary" : "bg-success") : "bg-white"}`} style={{ height: `${30 + (i % 5) * 15}%` }} />)}
          </div>
        </div>
      )}
      {state === "denied" && <div className="text-[0.95rem] font-semibold text-timer-text">{t("round.micDenied")}</div>}
    </div>
  );
}

/** §7.5 Before the round — as a mission briefing with a countdown. */
export function PreRound() {
  const { key } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const unlock = usePrefs((s) => s.unlockAudio);
  const { data, error } = useQuery({ queryKey: ["intro", key], queryFn: () => api<Intro>(`/rounds/${key}/intro`), retry: false });
  const [phase, setPhase] = useState<"brief" | "count">("brief");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { if (error && (error as ApiError).status === 401) nav("/register"); }, [error]);
  if (!data) return <><Header /><Spinner /></>;
  const r = data.round;

  const begin = async () => {
    unlock();
    await enterFullscreen(); // must run inside the click (user gesture)
    if (data.active) return launch();
    setPhase("count");
  };
  const launch = async () => {
    try {
      const a = await api<{ id: string }>(`/rounds/${key}/attempts`, { body: { clientId } });
      await qc.invalidateQueries({ queryKey: ["progress"] });
      nav(`/round/${a.id}`, { replace: true });
    } catch (e) {
      setErr((e as ApiError).code);
      setPhase("brief");
      sfx("error");
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    }
  };

  const objectives = [
    r.bhashiniDraft ? t("preRound.objMain") : t("preRound.objTrial"),
    t("preRound.objNumbers"),
    t("preRound.fullMeaning"),
    ...(r.key === "primary" ? [t("preRound.typingOnly")] : []),
    t("preRound.cannotLeave"),
    t("preRound.threeChances"),
  ];

  return (
    <>
      <Header />
      <Ambient density={10} />
      {phase === "count" && <Countdown onDone={launch} />}
      <Page>
        <motion.div initial={{ opacity: 0, y: 30, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 140, damping: 18 }}
          className="relative mx-auto max-w-4xl card shadow-pop overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="pre-title">
          <div className="relative bg-gradient-to-r from-navy via-royal-deep to-royal-bright text-white px-6 sm:px-8 py-6 flex items-center gap-5">
            <motion.div initial={{ rotate: -30, scale: 0 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: "spring", delay: 0.2 }}><Medal k={r.key} size={84} shine /></motion.div>
            <div className="flex-1">
              <div className="text-xs font-extrabold uppercase tracking-[0.25em] text-orange-200">{t("preRound.heading")} · {r.levelLabel}</div>
              <h1 id="pre-title" className="text-3xl sm:text-4xl font-extrabold">{roundName(r)}</h1>
              <div className="text-blue-100">{t("preRound.headingEn")}</div>
            </div>
            <span className="chip bg-white/15 border-white/30 text-white text-base">{t("common.chanceOf", { n: data.chance, max: data.maxChances })}</span>
          </div>
          <div className="grid md:grid-cols-[1.3fr_1fr] gap-6 p-6 sm:p-8">
            <div>
              <h2 className="text-sm font-extrabold uppercase tracking-widest text-royal">{t("preRound.objectives")}</h2>
              <ul className="mt-3 space-y-2.5">
                {objectives.map((o, i) => (
                  <motion.li key={o} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.08 }} className="flex gap-3 text-[1rem]">
                    <span className="w-6 h-6 shrink-0 rounded-md border-2 border-primary/60 grid place-items-center text-primary text-xs font-extrabold">{i + 1}</span>{o}
                  </motion.li>
                ))}
              </ul>
              {r.voiceTyping && <div className="mt-5"><MicCheck /></div>}
            </div>
            <div className="space-y-4">
              <div className="rounded-card bg-cream border border-orange-100 px-5 py-4 flex items-center gap-4">
                <motion.span animate={{ rotate: [0, 360] }} transition={{ duration: 6, repeat: Infinity, ease: "linear" }} className="w-12 h-12 rounded-full bg-primary text-white grid place-items-center text-2xl">⏱</motion.span>
                <div><div className="text-sm text-muted font-semibold">{t("preRound.timeYouHave")}</div><div className="text-4xl font-extrabold text-primary">{formatLimit(r.timeLimitMinutes)}</div></div>
              </div>
              <div className="rounded-card bg-amber-50 border border-amber-200 px-5 py-4">
                <div className="text-sm font-extrabold uppercase tracking-widest text-amber-700">{t("preRound.rewards")}</div>
                <div className="mt-2 flex items-center gap-2 font-bold"><Coin size={22} /> {t("preRound.creditsReward", { n: r.creditCap })}</div>
                <div className="mt-1.5 flex items-center gap-2 font-bold"><Medal k={r.key} size={26} /> {t("preRound.willBecome", { title: r.titleEn })}</div>
              </div>
              {data.lines.map((l) => <SahayikaLine key={l.id} line={l} />)}
            </div>
          </div>
          <div className="px-6 sm:px-8 pb-6 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
            <button className="text-muted font-semibold underline" onClick={() => nav("/journey")}>← {t("common.back")}</button>
            <span className="text-xs text-muted">{t("preRound.fullscreenNote")}</span>
            {!data.unlocked ? <div className="text-muted font-semibold">🔒 {t("journey.lockedHint")}</div>
              : data.chancesLeft === 0 && !data.active ? <div className="text-muted font-semibold">{t("journey.noChances")}</div>
                : <GameButton sound="pop" className="px-9 py-4 text-xl animate-breathe" onClick={begin}>{data.active ? t("journey.resume") : t("preRound.start")} ▶</GameButton>}
          </div>
          {err && <div className="err px-8 pb-4">{t("common.error")} ({err})</div>}
        </motion.div>
      </Page>
    </>
  );
}
