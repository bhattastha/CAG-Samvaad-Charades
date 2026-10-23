import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { lineById, useConfig, useLines, useProgress } from "../lib/queries";
import { sfx } from "../lib/sfx";
import { useToasts, type KeyboardMode } from "../lib/store";
import { roundName, t, tList } from "../lib/strings";
import { Coin, Header, Page, PageTitle } from "../components/Layout";
import { SahayikaLine } from "../components/Sahayika";
import { GameButton, Medal } from "../components/Juice";
import { TranslationEditor, type EditorHandle } from "../editor/TranslationEditor";
import { InscriptKeyboard } from "../editor/InscriptKeyboard";
import { VoiceTyping } from "../editor/voice";
import { Icon } from "../components/Icon";

export function CreditPills() {
  const { data: cfg } = useConfig();
  if (!cfg) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="chip-credit"><Coin size={14} />{t("total.registration")} {cfg.registration.credits}</span>
      {cfg.rounds.map((r) => <span key={r.key} className="chip-credit">{r.nameEn} {r.creditCap}</span>)}
      <span className="font-extrabold text-gold-deep tnum">= {cfg.maxCredits}</span>
    </span>
  );
}

/** Practice instance of the real editor: same component, nothing saved (§7.3). */
export function Practice() {
  const [mode, setMode] = useState<KeyboardMode>("roman");
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const ed = useRef<EditorHandle>(null);
  const voice = useRef<VoiceTyping | null>(null);
  const push = useToasts((s) => s.push);
  const toggleVoice = () => {
    if (listening) { voice.current?.stop(); return; }
    sfx("pop");
    voice.current = new VoiceTyping({
      onInterim: (x) => ed.current?.setInterim(x),
      onFinal: (x) => ed.current?.insertText(x, "asr"),
      onUnavailable: () => push(t("round.voiceUnavailable"), "info"),
      onState: (s) => setListening(s === "listening"),
    });
    voice.current.start();
  };
  const tab = (m: KeyboardMode, label: string, icon: string) => (
    <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setMode(m); sfx("toggle"); }} aria-pressed={mode === m}
      className={`flex-1 inline-flex items-center gap-2 rounded-ui px-3 py-2 text-left border transition ${mode === m ? "border-navy bg-navy text-white" : "border-slate-200 bg-white text-navy hover:border-navy-600"}`}>
      <Icon name={icon} size={17} /> <span className="font-semibold">{label}</span>
    </motion.button>
  );
  return (
    <div className="card p-4 sm:p-5">
      <h3 className="text-lg font-bold text-navy mb-3 flex items-center gap-2"><Icon name="edit" size={18} className="text-navy-600" /> {t("howToPlay.writeWaysHeading")}</h3>
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        {tab("roman", t("howToPlay.phonetic"), "type")}
        {tab("inscript", t("howToPlay.inscript"), "keyboard")}
      </div>
      <div className="rounded-ui border border-slate-300 bg-white p-3 min-h-[92px] focus-within:border-navy-600 focus-within:ring-4 focus-within:ring-blue-100 transition" translate="no">
        <TranslationEditor ref={ed} value={text} onChange={setText} modeOverride={mode} ariaLabel={t("howToPlay.tryHere")}
          placeholder={mode === "roman" ? t("howToPlay.phoneticExample") : t("howToPlay.tryHere")}
          onBlocked={() => { push(t("round.copyPasteToast"), "warn"); sfx("error"); }} onXlitAccept={() => sfx("pop")} />
      </div>
      {mode === "inscript" && <div className="mt-3"><InscriptKeyboard compact onKey={(c) => { ed.current?.insertText(c, "keyboard"); sfx("tap"); }} onBackspace={() => ed.current?.backspace()} /></div>}
      <div className="mt-3 flex items-center gap-3 flex-wrap">
        <GameButton variant="plain" sound={null} onClick={toggleVoice} className={`btn rounded-ui px-4 py-2 font-bold text-white ${listening ? "bg-timer-text" : "bg-navy hover:bg-navy-700"}`}>
          <Icon name={listening ? "stop" : "mic"} size={18} /> {listening ? t("round.listening") : t("howToPlay.voice")}
        </GameButton>
        <span className="chip bg-primary-soft border-primary-ring/60 text-primary-strong text-xs">{t("howToPlay.voiceOnlyTrial")}</span>
      </div>
      <p className="mt-2 text-xs text-muted">{t("howToPlay.practiceNote")} · {t("round.xlitHint")}</p>
    </div>
  );
}

function ScoreInfographic() {
  const { data: cfg } = useConfig();
  if (!cfg) return null;
  const w = cfg.scoringWeights;
  const items: [string, number, string][] = [
    [t("reportCard.measureTranslation"), w.translation, "bg-primary"], [t("reportCard.measureCompletion"), w.completion, "bg-navy-600"],
    [t("reportCard.measureSentence"), w.sentenceConstruction, "bg-success"], [t("reportCard.measureGlossary"), w.glossary, "bg-gold"], [t("reportCard.measureTime"), w.time, "bg-sky-500"],
  ];
  return (
    <div className="space-y-2">
      {items.map(([label, pts, c], i) => (
        <div key={label} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-3">
          <span className="font-semibold text-navy">{label}</span>
          <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden"><motion.div className={`h-full rounded-full ${c}`} initial={{ width: 0 }} animate={{ width: `${pts * 3}%` }} transition={{ delay: 0.2 + i * 0.1, duration: 0.5, ease: "easeOut" }} /></div>
          <span className="font-extrabold tnum text-right text-navy">{pts}</span>
        </div>
      ))}
      <div className="pt-2 flex flex-wrap gap-2 items-center"><span className="text-sm text-muted">{t("howToPlay.creditsLabel")}:</span><CreditPills /></div>
      <div className="flex gap-3 pt-2">{cfg.rounds.map((r) => <div key={r.key} className="text-center text-xs"><Medal k={r.key} size={52} /><div className="mt-1 font-semibold text-navy">{r.titleEn}</div><div className="text-muted">{roundName(r)}</div></div>)}</div>
    </div>
  );
}

/** §7.3 How to play — as a short training sequence. */
export function HowToPlay() {
  const nav = useNavigate();
  const { data: lines } = useLines("before_game");
  const { data: prog } = useProgress();
  const steps = tList<{ title: string; body: string }>("howToPlay.steps");
  const [i, setI] = useState(0);
  const returning = !!prog?.summary?.rounds.some((r) => r.chancesUsed > 0);
  const line = lineById(lines, returning ? "before_game.screen.how_to_play_returning" : "before_game.screen.how_to_play_new");
  const go = (n: number) => { setI(n); sfx("whoosh"); };
  const last = i === steps.length - 1;
  return (
    <>
      <Header />
      <Page>
        <PageTitle hi={t("howToPlay.heading")} en={t("howToPlay.headingEn")} right={<button className="inline-flex items-center gap-1 text-muted font-semibold hover:text-navy" onClick={() => nav("/rules")}>{t("common.skip")} <Icon name="chevronRight" size={16} /></button>} />
        <div className="grid lg:grid-cols-[1.25fr_1fr] gap-6 items-start">
          <div className="card p-5 sm:p-7 overflow-hidden">
            <div className="flex gap-2 mb-5" role="tablist">
              {steps.map((s, n) => (
                <button key={n} role="tab" aria-selected={n === i} onClick={() => go(n)} className="flex-1 group">
                  <div className={`h-1.5 rounded-full transition ${n < i ? "bg-navy" : n === i ? "bg-primary" : "bg-slate-200 group-hover:bg-slate-300"}`} />
                  <div className={`mt-1.5 text-xs font-bold text-left ${n === i ? "text-navy" : "text-muted"}`}><span className="tnum">{String(n + 1).padStart(2, "0")}</span> · {s.title}</div>
                </button>
              ))}
            </div>
            <AnimatePresence mode="wait">
              <motion.div key={i} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.22, ease: "easeOut" }}>
                <h2 className="text-2xl font-extrabold text-navy tracking-tight">{steps[i]?.title}</h2>
                <p className="mt-2 text-[1.06rem] leading-relaxed text-ink/85">{steps[i]?.body}</p>
                <div className="mt-5">{i === 1 ? <ScoreInfographic /> : i === 2 ? <Practice /> : i === 0 ? <MissionArt /> : <SahayikaLine line={line} tone="blue" />}</div>
              </motion.div>
            </AnimatePresence>
            <div className="mt-6 pt-4 border-t border-slate-200 flex justify-between">
              <GameButton variant="ghost" disabled={i === 0} onClick={() => go(i - 1)}><Icon name="chevronLeft" size={18} /> {t("common.back")}</GameButton>
              {last ? <GameButton sound="success" onClick={() => nav("/rules")}>{t("howToPlay.finish")} <Icon name="check" size={18} /></GameButton>
                : <GameButton onClick={() => go(i + 1)}>{t("common.next")} <Icon name="arrowRight" size={18} /></GameButton>}
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <SahayikaLine line={line} tone="blue" />
            <ol className="card p-5 space-y-2.5">
              {tList("howToPlay.points").map((p, n) => (
                <motion.li key={n} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: n * 0.04, duration: 0.25 }} className="flex gap-3 text-[0.95rem] text-ink">
                  <span className="shrink-0 w-6 h-6 rounded-md bg-navy-50 border border-slate-200 text-navy grid place-items-center text-xs font-bold tnum">{n + 1}</span>{p}
                </motion.li>
              ))}
            </ol>
          </div>
        </div>
      </Page>
    </>
  );
}

/** Step 1 art: an English page turning into a Hindi page. */
function MissionArt() {
  return (
    <div className="flex items-center justify-center gap-6 py-4">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="w-32 h-40 rounded-ui bg-white border border-slate-200 shadow-card p-3 space-y-1.5">
        <div className="text-[10px] font-bold text-muted tracking-wider">AUDIT REPORT</div>
        {[90, 75, 85, 60, 80, 70].map((w, i) => <div key={i} className="h-1.5 rounded bg-slate-200" style={{ width: `${w}%` }} />)}
        <div className="text-2xl font-bold text-navy text-center pt-1">A</div>
      </motion.div>
      <motion.div animate={{ x: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }} className="w-11 h-11 rounded-full bg-primary text-white grid place-items-center shadow-glow" aria-hidden><Icon name="arrowRight" size={22} /></motion.div>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="w-32 h-40 rounded-ui bg-white border border-slate-200 border-t-4 border-t-primary shadow-card p-3 space-y-1.5">
        <div className="text-[10px] font-bold text-primary-strong">लेखापरीक्षा प्रतिवेदन</div>
        {[85, 70, 90, 55, 80, 65].map((w, i) => <motion.div key={i} className="h-1.5 rounded bg-navy-600/70" initial={{ width: 0 }} animate={{ width: `${w}%` }} transition={{ delay: 0.3 + i * 0.15 }} />)}
        <div className="text-2xl font-bold text-primary-strong text-center pt-1">अ</div>
      </motion.div>
    </div>
  );
}
