import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { lineById, useConfig, useLines, useProgress } from "../lib/queries";
import { usePrefs, useToasts, type KeyboardMode } from "../lib/store";
import { t, tList } from "../lib/strings";
import { Header, Page, PageTitle } from "../components/Layout";
import { SahayikaLine } from "../components/Sahayika";
import { TranslationEditor, type EditorHandle } from "../editor/TranslationEditor";
import { InscriptKeyboard } from "../editor/InscriptKeyboard";
import { VoiceTyping } from "../editor/voice";

export function CreditPills() {
  const { data: cfg } = useConfig();
  if (!cfg) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="chip-credit">{t("total.registration")} {cfg.registration.credits}</span>
      {cfg.rounds.map((r) => <span key={r.key} className="chip-credit">{r.name.replace(" राउंड", "")} {r.creditCap}</span>)}
      <span className="font-bold text-primary-strong">= {cfg.maxCredits}</span>
    </span>
  );
}

/** Practice instance of the real editor: same component, nothing saved (§7.3). */
function Practice() {
  const [mode, setMode] = useState<KeyboardMode>("roman");
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const ed = useRef<EditorHandle>(null);
  const voice = useRef<VoiceTyping | null>(null);
  const push = useToasts((s) => s.push);
  const toggleVoice = () => {
    if (listening) { voice.current?.stop(); return; }
    voice.current = new VoiceTyping({
      onInterim: (x) => ed.current?.setInterim(x),
      onFinal: (x) => ed.current?.insertText(x, "asr"),
      onUnavailable: () => push(t("round.voiceUnavailable"), "info"),
      onState: (s) => setListening(s === "listening"),
    });
    voice.current.start();
  };
  const tab = (m: KeyboardMode, label: string, n: number) => (
    <button onClick={() => setMode(m)} className={`flex-1 rounded-xl px-3 py-2 text-left border-2 transition ${mode === m ? "border-primary bg-primary-soft" : "border-gray-200 bg-white hover:border-orange-200"}`}>
      <span className="text-xs font-bold text-primary-strong">{n}</span> <span className="font-semibold">{label}</span>
    </button>
  );
  return (
    <div className="card p-4 sm:p-5">
      <h2 className="text-xl font-bold text-primary-strong mb-3">{t("howToPlay.writeWaysHeading")}</h2>
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        {tab("roman", t("howToPlay.phonetic"), 1)}
        {tab("inscript", t("howToPlay.inscript"), 2)}
      </div>
      <div className="rounded-xl border-2 border-dashed border-blue-200 bg-royal-soft/40 p-3 min-h-[92px]">
        <TranslationEditor ref={ed} value={text} onChange={setText} modeOverride={mode} ariaLabel={t("howToPlay.tryHere")}
          placeholder={mode === "roman" ? t("howToPlay.phoneticExample") : t("howToPlay.tryHere")}
          onBlocked={() => push(t("round.copyPasteToast"), "warn")} />
      </div>
      {mode === "inscript" && <div className="mt-3"><InscriptKeyboard compact onKey={(c) => ed.current?.insertText(c, "keyboard")} onBackspace={() => ed.current?.backspace()} /></div>}
      <div className="mt-3 flex items-center gap-3 flex-wrap">
        <button onClick={toggleVoice} className={`rounded-full px-4 py-2 font-bold text-white ${listening ? "bg-timer-text animate-pulse" : "bg-primary-strong"}`}>
          🎤 {listening ? t("round.listening") : t("howToPlay.voice")}
        </button>
        <span className="chip bg-primary-soft border-orange-200 text-primary-strong text-xs">{t("howToPlay.voiceOnlyTrial")}</span>
      </div>
      <p className="mt-2 text-xs text-muted">{t("howToPlay.practiceNote")} · {t("round.xlitHint")}</p>
    </div>
  );
}

/** §7.3 How to play — design 03. */
export function HowToPlay() {
  const nav = useNavigate();
  const { data: lines } = useLines("before_game");
  const { data: prog } = useProgress();
  const unlocked = usePrefs((s) => s.unlocked);
  const returning = !!prog?.summary?.rounds.some((r) => r.chancesUsed > 0);
  // Sahayika says how_to_play_returning once per session
  const said = (() => { try { return sessionStorage.getItem("hc.returningSaid") === "1"; } catch { return false; } })();
  const line = lineById(lines, returning ? "before_game.screen.how_to_play_returning" : "before_game.screen.how_to_play_new");
  if (returning && line && !said) try { sessionStorage.setItem("hc.returningSaid", "1"); } catch { /* ignore */ }
  const points = tList("howToPlay.points");
  return (
    <>
      <Header />
      <Page>
        <PageTitle hi={t("howToPlay.heading")} en="How to play" right={<button className="btn-primary" onClick={() => nav("/rules")}>{t("common.next")} <span aria-hidden>→</span></button>} />
        <div className="grid lg:grid-cols-[1.25fr_1fr] gap-6">
          <ol className="card p-5 sm:p-6 space-y-3.5 animate-rise">
            {points.map((p, i) => (
              <li key={i} className="flex gap-3 items-start" style={{ animationDelay: `${i * 60}ms` }}>
                <span className={`shrink-0 w-9 h-9 rounded-full grid place-items-center font-bold ${i === 2 ? "bg-primary text-white" : "bg-white border-2 border-gray-200 text-navy"}`}>{i + 1}</span>
                <span className="text-[17px] leading-relaxed pt-1">{i === 2 ? <span className="flex flex-wrap items-center gap-2">{p.split(":")[0]}: <CreditPills /></span> : p}</span>
              </li>
            ))}
          </ol>
          <div className="flex flex-col gap-4">
            <SahayikaLine line={line} tone="blue" autoSpeak={unlocked && !(returning && said)} />
            <Practice />
          </div>
        </div>
      </Page>
    </>
  );
}
