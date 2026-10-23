import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatLimit, type RoundConfig } from "@hc/shared";
import { api, ApiError, clientId } from "../lib/api";
import { usePrefs } from "../lib/store";
import { t } from "../lib/strings";
import type { Line } from "../lib/voice";
import { Header, Page, PageTitle, Spinner } from "../components/Layout";
import { SahayikaLine, useAutoSpeak } from "../components/Sahayika";
import { micCheck } from "../editor/voice";

interface Intro { round: RoundConfig; chance: number; maxChances: number; unlocked: boolean; chancesLeft: number; active: boolean; best: number | null; lines: Line[] }

export async function enterFullscreen() {
  const el: any = document.documentElement;
  try {
    if (!document.fullscreenElement) await (el.requestFullscreen?.({ navigationUI: "hide" }) ?? el.webkitRequestFullscreen?.());
  } catch { /* iPhone Safari: no element fullscreen; visibility tracking covers it (§12) */ }
}

/** Mic check before the clock starts (परख only, §15.1). */
function MicCheck() {
  const [state, setState] = useState<"idle" | "on" | "ok" | "denied">("idle");
  const [level, setLevel] = useState(0);
  const stop = useRef<(() => void) | null>(null);
  useEffect(() => () => stop.current?.(), []);
  const start = async () => {
    try {
      stop.current = await micCheck((v) => { setLevel(v); if (v > 0.12) setState("ok"); });
      setState((s) => (s === "ok" ? s : "on"));
    } catch { setState("denied"); }
  };
  return (
    <div className="rounded-card border-2 border-dashed border-blue-200 bg-royal-soft/50 p-3.5">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-2xl">🎤</span>
        {state === "idle" && <button type="button" onClick={start} className="btn-blue py-2 text-base">{t("preRound.micStart")}</button>}
        {(state === "on" || state === "ok") && (
          <div className="flex-1 min-w-[12rem]">
            <div className="text-sm font-semibold">{state === "ok" ? "✅ " + t("preRound.micOk") : t("round.micCheck")}</div>
            <div className="mt-1 h-2.5 rounded-full bg-white overflow-hidden"><div className="h-full bg-success transition-[width] duration-100" style={{ width: `${Math.min(100, level * 220)}%` }} /></div>
          </div>
        )}
        {state === "denied" && <div className="text-[15px] font-semibold text-timer-text">{t("round.micDenied")}</div>}
      </div>
    </div>
  );
}

/** §7.5 Before the round (modal) — design 07. */
export function PreRound() {
  const { key } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const unlocked = usePrefs((s) => s.unlocked);
  const unlock = usePrefs((s) => s.unlockAudio);
  const { data, error } = useQuery({ queryKey: ["intro", key], queryFn: () => api<Intro>(`/rounds/${key}/intro`), retry: false });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useAutoSpeak(data ? { ...data.lines[0], en: data.lines.map((l) => l.en).join(" ") } : null, unlocked);

  if (error && (error as ApiError).status === 401) { nav("/register"); return null; }
  const start = async () => {
    unlock();
    setBusy(true);
    await enterFullscreen(); // must run inside the click (user gesture)
    try {
      const a = await api<{ id: string }>(`/rounds/${key}/attempts`, { body: { clientId } });
      await qc.invalidateQueries({ queryKey: ["progress"] });
      nav(`/round/${a.id}`, { replace: true });
    } catch (e) {
      setErr((e as ApiError).code);
      setBusy(false);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    }
  };
  const r = data?.round;
  const rules: [string, string][] = r ? [
    ...(r.key === "primary" ? [["⌨️", t("preRound.typingOnly")] as [string, string]] : []),
    ["🔒", t("preRound.cannotLeave")],
    ["📋", t("preRound.fullMeaning")],
    ["🔁", t("preRound.threeChances")],
  ] : [];
  return (
    <>
      <Header />
      <Page>
        <PageTitle hi={t("preRound.heading")} en="Before the round" />
        <div className="relative">
          <div className="absolute inset-0 rounded-card bg-gray-200/60 backdrop-blur-sm" />
          {!data ? <Spinner /> : (
            <div className="relative mx-auto max-w-2xl card shadow-pop p-5 sm:p-7 animate-pop" role="dialog" aria-modal="true" aria-labelledby="pre-title">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 id="pre-title" className="text-3xl font-bold text-primary">{r!.name}</h2>
                  <div className="text-[15px] font-semibold text-primary-strong mt-1">{t("preRound.willBecome", { title: r!.title })}</div>
                </div>
                <span className="chip-plain text-base">{t("common.chanceOf", { n: data.chance, max: data.maxChances })}</span>
              </div>
              <div className="mt-5 rounded-card bg-cream border border-orange-100 px-5 py-4 flex items-center gap-4">
                <span className="w-12 h-12 rounded-full bg-primary text-white grid place-items-center text-2xl">⏱</span>
                <span className="text-lg">{t("preRound.timeYouHave")}</span>
                <span className="en text-4xl font-bold text-primary">{formatLimit(r!.timeLimitMinutes)}</span>
              </div>
              <ul className="mt-5 space-y-2.5">
                {rules.map(([ic, txt]) => <li key={txt} className="flex gap-3 text-[16px]"><span className="w-6 text-center">{ic}</span><span>{txt}</span></li>)}
              </ul>
              {r!.voiceTyping && <div className="mt-4"><MicCheck /></div>}
              <div className="mt-5 grid sm:grid-cols-[1fr_auto] gap-3 items-center">
                <div className="space-y-2">{data.lines.map((l) => <SahayikaLine key={l.id} line={l} autoSpeak={false} />)}</div>
                {!data.unlocked ? <div className="text-muted font-semibold">🔒 {t("ui.levelLocked")}</div>
                  : data.chancesLeft === 0 && !data.active ? <div className="text-muted font-semibold">{t("ui.noChancesLeft")}</div>
                    : <button className="btn-primary px-8 py-4 text-xl" onClick={start} disabled={busy}>{data.active ? t("ui.resumeRound") : t("preRound.start")} <span aria-hidden>→</span></button>}
              </div>
              <p className="mt-3 text-xs text-muted">{t("preRound.fullscreenNote")}</p>
              {err && <div className="err mt-2">{err === "no_pages" ? t("ui.error") : err === "no_chances" ? t("ui.noChancesLeft") : err === "locked" ? t("ui.levelLocked") : t("ui.error")}</div>}
            </div>
          )}
        </div>
      </Page>
    </>
  );
}
