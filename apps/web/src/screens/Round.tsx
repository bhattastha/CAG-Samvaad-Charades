import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { completion, fill, formatClock, type PageData } from "@hc/shared";
import { api } from "../lib/api";
import { useConfig, useLines } from "../lib/queries";
import { usePrefs, useToasts, type KeyboardMode } from "../lib/store";
import { t } from "../lib/strings";
import { announce, type Line } from "../lib/voice";
import { sfx } from "../lib/sfx";
import { Burst, floatText } from "../components/Juice";
import { Hud } from "../round/Hud";
import { Header, ProgressBar, Spinner } from "../components/Layout";
import { SahayikaLine } from "../components/Sahayika";
import { TranslationEditor, type EditorHandle } from "../editor/TranslationEditor";
import { InscriptKeyboard } from "../editor/InscriptKeyboard";
import { GlossaryDrawer } from "../editor/GlossaryDrawer";
import { VoiceTyping } from "../editor/voice";
import { useAttempt } from "../round/useAttempt";
import { useFairPlay } from "../round/useFairPlay";
import { DraftPanel, fk, GlossPopover, SourcePanel, type FieldKey, type PopoverState } from "../round/PageViews";
import { ChatPanel } from "../round/ChatPanel";
import { enterFullscreen } from "./PreRound";

/** §7.6 Round — designs 05, 08, 10, 12. */
export function Round() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: cfg } = useConfig();
  const at = useAttempt(id, cfg?.fairPlay.autosaveIntervalSeconds ?? 10);
  const { view, answers } = at;
  const round = cfg?.rounds.find((r) => r.key === view?.roundKey);
  const { data: lines } = useLines(view?.roundKey ?? "trial");
  const push = useToasts((s) => s.push);
  const { keyboard, setKeyboard } = usePrefs();

  const active = view?.status === "active" && at.save !== "closed";
  const readOnly = !active || at.save === "other_window";

  // ---------- Sahayika in-round lines (§10.2) ----------
  const [slim, setSlim] = useState<Line | null>(null);
  const slimTimer = useRef<number>();
  const saidKey = `hc.said.${id}`;
  const said = useRef<Set<string>>(new Set((() => { try { return JSON.parse(sessionStorage.getItem(saidKey) ?? "[]"); } catch { return []; } })()));
  const sayLine = useCallback((moment: string, vars: Record<string, string | number> = {}, once = true) => {
    if (!view || !lines) return;
    if (once && said.current.has(moment)) return;
    const l = lines.find((x) => x.id === `${view.roundKey}.${moment}`) ?? lines.find((x) => x.id === `${view.roundKey}.in_round.${moment}`);
    if (!l) return;
    said.current.add(moment);
    try { sessionStorage.setItem(saidKey, JSON.stringify([...said.current])); } catch { /* ignore */ }
    const filled = { ...l, en: fill(l.en, vars), hi: fill(l.hi, vars) };
    setSlim(filled);
    announce(filled);
    window.clearTimeout(slimTimer.current);
    slimTimer.current = window.setTimeout(() => setSlim(null), 8000); // auto-hide after 8 s
  }, [view, lines, saidKey]);

  // ---------- blocked copy/paste ----------
  const lastBlock = useRef(0);
  const onBlocked = useCallback((kind?: string) => {
    const now = Date.now();
    if (now - lastBlock.current < 700) return;
    lastBlock.current = now;
    if (kind === "locked") { push(t("round.numbersLocked"), "info"); sfx("error"); return; }
    push(t("round.copyPasteToast"), "warn");
    sfx("error");
    sayLine("in_round.copy_paste_blocked", {}, false);
    if (view) api(`/attempts/${view.id}/events`, { body: { type: "paste_blocked" } }).catch(() => {});
  }, [push, sayLine, view]);

  const fair = useFairPlay(view?.id ?? null, !!active, () => onBlocked("paste"), view?.leftPageCount ?? 0);

  // ---------- clock ----------
  const [nowMs, setNow] = useState(() => at.now());
  useEffect(() => { const iv = window.setInterval(() => setNow(at.now()), 500); return () => window.clearInterval(iv); }, [at]);
  const deadline = view ? new Date(view.deadlineAt).getTime() : 0;
  const startMs = view ? new Date(view.startedAt).getTime() : 0;
  const remaining = Math.max(0, Math.floor((deadline - nowMs) / 1000));
  const limitS = (round?.timeLimitMinutes ?? 20) * 60;
  const [srNote, setSrNote] = useState("");

  // ---------- completion ----------
  const prog = useMemo(() => {
    if (!view || !round) return { done: 0, total: 1 };
    return completion(round, view.page as unknown as PageData, answers, cfg?.scoring.minWordsPerSentence ?? 2);
  }, [view, round, answers, cfg]);
  const partsLeft = prog.total - prog.done;

  // ---------- triggers ----------
  const lastTyping = useRef(Date.now());
  const onTyping = useCallback(() => { lastTyping.current = Date.now(); }, []);
  useEffect(() => {
    if (!active || !view || !lines) return;
    sayLine("in_round.round_start", { page_no: view.page.printedPageNo ?? "" });
    const tm = window.setTimeout(() => sayLine("in_round.round_start_followup"), 9000);
    return () => window.clearTimeout(tm);
  }, [active, view?.id, lines]);
  useEffect(() => {
    if (!active || !view) return;
    const used = (nowMs - startMs) / 1000;
    if (used >= limitS / 2) sayLine("in_round.half_time");
    const w = cfg?.fairPlay;
    if (w && remaining <= w.warnAtMinutesLeft * 60 && remaining > w.warnAtMinutesLeftSecond * 60) {
      if (!said.current.has("in_round.five_min_left")) { push(t("round.fiveMinToast"), "info"); setSrNote(t("round.fiveMinSr")); sfx("warn"); }
      sayLine("in_round.five_min_left");
    }
    if (w && remaining <= w.warnAtMinutesLeftSecond * 60 && remaining > 0) {
      if (!said.current.has("in_round.one_min_left")) { setSrNote(t("round.oneMinSr")); sfx("warn"); }
      sayLine("in_round.one_min_left");
    }
    if (view.roundKey === "trial" && Date.now() - lastTyping.current > 90_000) { sayLine("in_round.under_source"); lastTyping.current = Date.now(); }
  }, [Math.floor(nowMs / 5000)]);
  // spatial + sound feedback when a sentence/part is cleared; a burst when everything is done
  const prevDone = useRef<number | null>(null);
  const [burst, setBurst] = useState(0);
  useEffect(() => {
    if (prevDone.current !== null && prog.done > prevDone.current && active) {
      const anchor = document.querySelector("[data-hud-progress]")?.getBoundingClientRect() ?? null;
      floatText(view?.roundKey === "trial" ? t("round.sentenceDone") : t("round.partCleared"), anchor, "good");
      sfx(prog.done >= prog.total ? "fanfare" : "success");
      if (prog.done >= prog.total) { setBurst((b) => b + 1); floatText(t("round.allCleared"), null, "gold"); }
    }
    prevDone.current = prog.done;
  }, [prog.done]);
  useEffect(() => {
    if (!active || prog.total < 2) return;
    if (prog.done >= prog.total) sayLine("in_round.all_done_before_submit");
    else if (prog.done >= Math.ceil(prog.total / 2)) sayLine("in_round.half_parts_done");
  }, [prog.done]);

  // ---------- submit ----------
  const [confirmUntil, setConfirmUntil] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const doSubmit = useCallback(async (auto = false) => {
    if (submitting) return;
    setSubmitting(true);
    voice.current?.stop();
    try {
      await at.submit();
    } catch { /* the server job submits from the last autosave anyway */ }
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    await qc.invalidateQueries({ queryKey: ["progress"] });
    nav(`/report/${id}?fx=${auto ? "timeup" : "done"}`, { replace: true });
  }, [at, id, nav, qc, submitting]);
  const pressSubmit = () => {
    const win = (cfg?.fairPlay.confirmSubmitWindowSeconds ?? 4) * 1000;
    if (partsLeft > 0 && Date.now() > confirmUntil) {
      setConfirmUntil(Date.now() + win);
      sayLine("in_round.submit_with_parts_left", { parts_left: partsLeft }, false);
      sfx("warn");
      window.setTimeout(() => setConfirmUntil(0), win);
      return;
    }
    doSubmit();
  };
  const timeUpFired = useRef(false);
  useEffect(() => {
    if (active && view && remaining === 0 && deadline > 0 && !timeUpFired.current) {
      timeUpFired.current = true;
      sayLine("in_round.time_up", {}, false);
      push(t("round.timeUp"), "info");
      window.setTimeout(() => doSubmit(true), 1800);
    }
  }, [remaining, active]);

  // ---------- editors registry ----------
  const editors = useRef(new Map<FieldKey, EditorHandle>());
  const register = useCallback((k: FieldKey, h: EditorHandle | null) => { if (h) editors.current.set(k, h); else editors.current.delete(k); }, []);
  const [lastField, setLastField] = useState<FieldKey | null>(null);
  const [focusedPart, setFocusedPart] = useState<string | null>(null);
  const [sentenceIdx, setSentenceIdx] = useState<number | null>(null);
  const onFocus = useCallback((partId: string, key: string) => { setLastField(fk(partId, key)); setFocusedPart(partId); }, []);
  const xlitAccept = useCallback((i: number) => { if (view) api(`/attempts/${view.id}/events`, { body: { type: "xlit_accept", meta: { index: i } } }).catch(() => {}); }, [view]);

  // ---------- popovers & drawers ----------
  const [pop, setPop] = useState<PopoverState | null>(null);
  const [glossOpen, setGlossOpen] = useState(false);
  const [glossQuery, setGlossQuery] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [mobilePane, setMobilePane] = useState<"src" | "dst">("dst");
  const watchWords = view?.page.watchWords ?? [];
  // multi-page report bundles (10/20/30 pages): one printed page at a time in both panels
  const pageNos = useMemo(() => [...new Set((view?.page.parts ?? []).map((p) => p.pageNo).filter((n): n is number => typeof n === "number"))].sort((a, b) => a - b), [view]);
  const [pageIdx, setPageIdx] = useState(0);
  const curPage = pageNos[pageIdx];
  const visibleParts = useMemo(() => (pageNos.length > 1 ? (view?.page.parts ?? []).filter((p) => (p.pageNo ?? pageNos[0]) === curPage) : view?.page.parts ?? []), [view, pageNos, curPage]);
  const pageDone = (n: number) => (view?.page.parts ?? []).filter((p) => p.pageNo === n && p.editable && p.tickGroup).every((p) => answers[p.id]?.done);
  const watchTexts = useMemo(() => watchWords.map((w) => w.text), [watchWords]);

  // ---------- voice (परख only) ----------
  const voice = useRef<VoiceTyping | null>(null);
  const [listening, setListening] = useState(false);
  const toggleVoice = () => {
    if (!round?.voiceTyping) return;
    if (listening) { voice.current?.stop(); return; }
    sayLine("in_round.mic_tapped", {}, false);
    const target = () => editors.current.get(fk("passage", "t"));
    voice.current = new VoiceTyping({
      onInterim: (x) => target()?.setInterim(x),
      onFinal: (x) => { target()?.insertText(x + " ", "asr"); onTyping(); },
      onUnavailable: () => push(t("round.voiceUnavailable"), "info"),
      onState: (s) => setListening(s === "listening"),
    });
    voice.current.start();
  };
  useEffect(() => () => voice.current?.stop(), []);

  if (at.error) return <><Header /><div className="p-10 text-center text-lg">{t("common.error")}</div></>;
  if (!view || !round || !cfg) return <><Header /><Spinner /></>;
  if (view.status === "submitted" && !submitting) { nav(`/report/${id}`, { replace: true }); return null; }

  const isTrial = view.roundKey === "trial";
  const confirming = Date.now() < confirmUntil;
  const insertGlossary = (hi: string) => {
    const k = lastField ?? (isTrial ? fk("passage", "t") : null);
    const h = k ? editors.current.get(k) : null;
    if (h && !readOnly) { h.insertText(hi, "glossary"); setGlossOpen(false); }
  };

  const modeOptions: [KeyboardMode, string][] = [["roman", t("round.keyboardPhonetic").replace(/^.*:\s*/, "")], ["inscript", t("round.keyboardInscript")], ["device", t("round.keyboardDevice")]];
  const leftLine = (moment: string) => lines?.find((l) => l.id === `${view.roundKey}.in_round.${moment}`) ?? null;

  return (
    <div className="min-h-screen flex flex-col">
      <Header compact />
      <div className="sr-only" aria-live="assertive">{srNote}</div>

      {/* HUD (non-diegetic) + last-minute edge glow (meta) */}
      <div data-hud-progress className="sticky top-14 z-20">
        <Hud round={round} chanceNo={view.chanceNo} maxChances={cfg.maxChancesPerRound} remaining={remaining} limit={limitS}
          warn5={cfg.fairPlay.warnAtMinutesLeft * 60} warn1={cfg.fairPlay.warnAtMinutesLeftSecond * 60}
          progress={prog.done} total={prog.total} isTrial={isTrial} creditCap={view.creditCap} save={at.save} sample={view.page.sample} />
      </div>
      {active && remaining > 0 && remaining <= cfg.fairPlay.warnAtMinutesLeftSecond * 60 && (
        <div className="pointer-events-none fixed inset-0 z-[35] animate-pulse" style={{ boxShadow: "inset 0 0 120px 20px rgba(180,35,24,.35)" }} aria-hidden />
      )}
      <Burst fire={burst} count={36} spread={300} />
      {/* phone: switch panels */}
      <div className="lg:hidden mx-auto w-full px-3 mt-3">
        <div className="grid grid-cols-2 rounded-full bg-gray-100 p-1 text-[15px] font-semibold">
          {(["src", "dst"] as const).map((k) => (
            <button key={k} onClick={() => setMobilePane(k)} className={`rounded-full py-2 ${mobilePane === k ? "bg-white shadow text-primary-strong" : "text-muted"}`}>
              {k === "src" ? t("round.sourceLabel") : t("round.yourTranslation")}
            </button>
          ))}
        </div>
      </div>

      {pageNos.length > 1 && (
        <nav className="mx-auto w-full max-w-[1400px] px-3 sm:px-6 mt-3 flex items-center gap-3" aria-label={t("round.pageNav", { n: pageIdx + 1, total: pageNos.length })}>
          <button className="btn-ghost py-1.5 px-4 text-base" disabled={pageIdx === 0} onClick={() => { setPageIdx(pageIdx - 1); sfx("whoosh"); }}>← {t("round.prevPage")}</button>
          <div className="flex-1 flex items-center gap-1 overflow-x-auto py-1">
            {pageNos.map((n, i) => (
              <button key={n} onClick={() => { setPageIdx(i); sfx("tap"); }} aria-current={i === pageIdx}
                className={`shrink-0 min-w-8 h-8 px-2 rounded-full text-xs font-extrabold border-2 ${i === pageIdx ? "bg-primary border-primary text-white" : pageDone(n) ? "bg-success-soft border-green-300 text-green-800" : "bg-white border-gray-200 text-muted"}`}>
                {pageDone(n) && i !== pageIdx ? "✓" : n}
              </button>
            ))}
          </div>
          <span className="text-sm font-bold whitespace-nowrap">{t("round.pageNav", { n: pageIdx + 1, total: pageNos.length })}</span>
          <button className="btn-primary py-1.5 px-4 text-base" disabled={pageIdx === pageNos.length - 1} onClick={() => { setPageIdx(pageIdx + 1); sfx("whoosh"); }}>{t("round.nextPage")} →</button>
        </nav>
      )}
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-3 sm:px-6 py-3 grid lg:grid-cols-2 gap-4 pb-40">
        <section translate="no" className={`notranslate card flex flex-col min-h-[50vh] ${mobilePane === "src" ? "" : "hidden lg:flex"}`} aria-label={t("round.sourceLabel")}>
          <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50 rounded-t-card flex items-center gap-2">
            <span className="font-bold">📄 {t("round.sourceLabel")}</span><span className="text-sm text-muted">{t("round.sourceLabelEn")}</span>
            <span className="ml-auto text-xs text-royal hidden sm:inline">{t("round.glossaryHint")}</span>
          </div>
          <div className="p-4 sm:p-5 overflow-y-auto max-h-[calc(100vh-260px)]">
            <SourcePanel parts={visibleParts} terms={view.page.sourceTerms} focusedPart={focusedPart} sentenceIndex={isTrial ? sentenceIdx : null}
              onPartClick={(pid) => { setFocusedPart(pid); const f = view.page.parts.find((p) => p.id === pid)?.fields.find((x) => !x.numeric); if (f) editors.current.get(fk(pid, f.key))?.focus(); }}
              onTerm={(pid, key, tm, rect) => {
                const part = view.page.parts.find((p) => p.id === pid);
                const target = isTrial ? fk("passage", "t") : part?.fields.some((f) => f.key === key && !f.numeric) ? fk(pid, key) : null;
                setPop({ rect, title: `${tm.en} → ${tm.hi}`, options: [tm.hi, ...tm.variants].filter(Boolean).slice(0, 5), avoid: tm.avoid, mode: "insert", target });
              }} />
          </div>
        </section>

        <section translate="no" className={`notranslate card flex flex-col min-h-[50vh] border-primary/60 ${mobilePane === "dst" ? "" : "hidden lg:flex"}`} aria-label={t("round.yourTranslation")}>
          <div className="px-4 py-2.5 border-b border-orange-100 bg-cream rounded-t-card flex items-center gap-2">
            <span className="font-bold">✍️ {isTrial ? t("round.yourTranslation") : t("round.draftLabel").split("·")[0]}</span>
            {!isTrial && <span className="text-sm text-primary-strong">{t("round.draftLabel").split("·")[1]}</span>}
            {readOnly && <span className="ml-auto chip-plain text-xs">{t("round.readOnly")}</span>}
          </div>
          <div className="p-4 sm:p-5 overflow-y-auto max-h-[calc(100vh-260px)] flex-1">
            {isTrial ? (
              <TranslationEditor
                ref={(h) => register(fk("passage", "t"), h)}
                value={answers.passage?.fields.t ?? ""}
                onChange={(v) => at.update("passage", { field: ["t", v] })}
                readOnly={readOnly}
                sentenceTicks
                showLatin
                ariaLabel={t("round.yourTranslation")}
                placeholder={t("round.xlitHint")}
                onFocus={() => onFocus("passage", "t")}
                onBlocked={onBlocked}
                onTyping={onTyping}
                onCaretSentence={setSentenceIdx}
                onXlitAccept={xlitAccept}
              />
            ) : (
              <DraftPanel parts={visibleParts} answers={answers} readOnly={readOnly} watch={watchTexts} focusedPart={focusedPart} register={register}
                onField={(pid, key, v) => at.update(pid, { field: [key, v] })}
                onTick={(pid, done) => { at.update(pid, { done }); if (!done) sfx("tap"); }}
                onFocus={onFocus} onBlocked={onBlocked} onTyping={onTyping} onXlit={xlitAccept}
                onWatchClick={(pid, key, w) => {
                  const ww = watchWords.find((x) => x.text === w.word);
                  setPop({ rect: w.rect, title: ww?.en ? `${w.word} · ${ww.en}` : w.word, options: ww?.options ?? [], mode: "replace", target: fk(pid, key), range: { from: w.from, to: w.to } });
                  if (!ww?.options?.length) { setGlossQuery(ww?.en ?? ""); }
                }} />
            )}
          </div>
        </section>
      </main>

      {pop && (
        <GlossPopover s={pop} onClose={() => setPop(null)} onPick={(v) => {
          const h = pop.target ? editors.current.get(pop.target) : null;
          if (h && !readOnly) { pop.mode === "replace" && pop.range ? h.replaceRange(pop.range.from, pop.range.to, v) : h.insertText(v, "glossary"); }
          setPop(null);
        }} />
      )}

      {/* bottom bar */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-orange-100 shadow-[0_-8px_24px_-12px_rgba(34,41,59,.18)]">
        <div className="mx-auto max-w-[1400px] px-3 sm:px-6">
          {slim && <div className="pt-2"><SahayikaLine line={slim} autoSpeak={false} clamp onClose={() => setSlim(null)} /></div>}
          {keyboard === "inscript" && !readOnly && (
            <div className="pt-2"><InscriptKeyboard compact onKey={(c) => { const h = lastField && editors.current.get(lastField); h?.insertText(c, "keyboard"); }} onBackspace={() => { const h = lastField && editors.current.get(lastField); h?.backspace(); }} /></div>
          )}
          <div className="py-2.5 flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="kbd">{t("round.keyboardPhonetic")}</label>
            <select id="kbd" value={keyboard} onChange={(e) => setKeyboard(e.target.value as KeyboardMode)} className="rounded-full border-2 border-gray-200 bg-white px-3 py-2 text-[15px] font-semibold">
              {modeOptions.map(([k, l]) => <option key={k} value={k}>⌨ {l}</option>)}
            </select>
            {round.voiceTyping && (
              <button onClick={toggleVoice} disabled={readOnly} className={`rounded-full px-4 py-2 text-[15px] font-bold text-white ${listening ? "bg-timer-text animate-pulse" : "bg-primary-strong"}`}>
                🎤 {listening ? t("round.listening") : t("round.speak")}
              </button>
            )}
            <button onClick={() => setGlossOpen(true)} aria-label={t("common.glossaryButton")} className="rounded-full border-2 border-primary/60 px-4 py-2 text-[15px] font-semibold text-primary-strong hover:bg-primary-soft">📖 <span className="hidden sm:inline">{t("common.glossaryButton")}</span></button>
            <button onClick={() => setChatOpen(true)} aria-label={t("common.sahayikaButton")} className="rounded-full border-2 border-royal-bright/60 px-4 py-2 text-[15px] font-semibold text-royal hover:bg-royal-soft">💬 <span className="hidden sm:inline">{t("common.sahayikaButton")}</span></button>
            <span className="chip bg-timer-bg border-red-200 text-timer-text hidden md:inline-flex">🔒 {t("common.copyPasteOffBadge")}</span>
            <div className="flex-1 min-w-[10rem] flex items-center gap-3">
              <span className="text-[14px] sm:text-[15px] font-semibold whitespace-nowrap">{isTrial ? t("round.sentencesDone", { done: prog.done, total: prog.total }) : t("round.paragraphsDone", { done: prog.done, total: prog.total })}</span>
              <ProgressBar value={prog.done / (prog.total || 1)} striped />
            </div>
            <div className="flex items-center gap-2">
              {confirming && <span className="text-sm font-semibold text-timer-text animate-pop">{t("round.partsLeft", { n: partsLeft })}</span>}
              <button onClick={() => { sfx("tap"); pressSubmit(); }} disabled={readOnly || submitting} className={`btn-primary py-2.5 active:scale-90 transition-transform ${confirming ? "bg-timer-text hover:bg-timer-text animate-wiggle" : ""}`}>
                {submitting ? t("round.submitting") : confirming ? t("round.confirmSubmit") : t("round.submit")}
              </button>
            </div>
          </div>
        </div>
      </div>

      <GlossaryDrawer open={glossOpen} onClose={() => setGlossOpen(false)} onInsert={insertGlossary} initial={glossQuery} />
      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} attemptId={view.id} quick={cfg.sahayika.quickQuestions}
        thinking={lines?.find((l) => l.id === `${view.roundKey}.chat.thinking`) ?? null}
        opener={null} />

      {/* left the page: warning card on return (§12) */}
      {fair.left && active && (
        <div className="fixed inset-0 z-[95] bg-navy/50 grid place-items-center p-4" role="alertdialog" aria-modal="true">
          <div className="card max-w-md w-full p-6 animate-pop text-center">
            <div className="text-5xl">👀</div>
            <h2 className="mt-2 text-2xl font-bold text-primary">{leftLine("left_popup_title")?.hi}</h2>
            <SahayikaLine line={leftLine(fair.left.kind === "left_fullscreen" ? "left_fullscreen" : "left_tab")} />
            <p className="mt-3 text-[16px]">{t("round.leftPageCard")}</p>
            <p className="mt-2 font-semibold text-timer-text">{fill(leftLine("left_count_note")?.hi ?? "", { leaves: fair.count })}</p>
            <button className="btn-primary mt-5" onClick={async () => { await enterFullscreen(); fair.dismiss(); }}>{t("round.backToRound")}</button>
          </div>
        </div>
      )}

      {at.save === "other_window" && view.status === "active" && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[90] rounded-card bg-navy text-white px-5 py-3 shadow-pop font-semibold">🪟 {t("round.otherWindow")}</div>
      )}
    </div>
  );
}
