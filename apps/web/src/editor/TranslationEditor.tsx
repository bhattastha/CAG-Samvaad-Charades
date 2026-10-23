import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import History from "@tiptap/extension-history";
import { Extension } from "@tiptap/core";
import { INSCRIPT, romanToDevanagari } from "@hc/shared";
import { api } from "../lib/api";
import { usePrefs, type KeyboardMode } from "../lib/store";
import { t } from "../lib/strings";
import { ALLOW_LOCKED, decorationsPlugin, fromDoc, guardPlugin, LockedToken, pendingKey, pendingPlugin, toDoc, TRUSTED, type Pending } from "./extensions";

export interface EditorHandle {
  insertText(text: string, source: "glossary" | "asr" | "keyboard"): void;
  replaceRange(from: number, to: number, text: string): void;
  focus(): void;
  setInterim(text: string): void;
  backspace(): void;
}

export interface WatchClick { word: string; from: number; to: number; rect: DOMRect }

interface Props {
  value: string;
  locked?: string[];
  onChange(v: string): void;
  readOnly?: boolean;
  compact?: boolean;
  singleLine?: boolean;
  placeholder?: string;
  watch?: string[];
  sentenceTicks?: boolean;
  /** "Latin words" highlight (main-round drafts). */
  showLatin?: boolean;
  modeOverride?: KeyboardMode;
  ariaLabel: string;
  onFocus?(): void;
  onBlocked?(kind: "paste" | "copy" | "locked"): void;
  onTyping?(): void;
  onWatchClick?(w: WatchClick): void;
  onCaretSentence?(index: number): void;
  onXlitAccept?(index: number): void;
}

const xlitCache = new Map<string, string[]>();
async function fetchXlit(word: string, signal: AbortSignal): Promise<{ suggestions: string[]; fallback?: string }> {
  const k = word.toLowerCase();
  const hit = xlitCache.get(k);
  if (hit) return { suggestions: hit };
  try {
    const r = await api<{ suggestions: string[]; fallback?: string }>(`/xlit?word=${encodeURIComponent(word)}`, { signal });
    const clean = (r.suggestions ?? []).filter((s) => /[ऀ-ॿ]/.test(s)).slice(0, 4);
    if (clean.length) xlitCache.set(k, clean);
    return { suggestions: clean, fallback: r.fallback };
  } catch (e: any) {
    if (e?.name === "AbortError") throw e;
    return { suggestions: [], fallback: romanToDevanagari(word) };
  }
}

const isTouch = () => typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

/** The translation editor: one component for rounds, table cells and the practice box (§7.3). */
export const TranslationEditor = forwardRef<EditorHandle, Props>(function TranslationEditor(p, ref) {
  const prefMode = usePrefs((s) => s.keyboard);
  const mode: KeyboardMode = p.modeOverride ?? prefMode;
  const props = useRef(p);
  props.current = p;
  const modeRef = useRef(mode);
  modeRef.current = mode;

  // ---- transliteration state ----
  const [word, setWord] = useState<{ text: string; from: number; to: number } | null>(null);
  const [sugs, setSugs] = useState<{ word: string; list: string[]; fallback?: string } | null>(null);
  const [hi, setHi] = useState(0);
  const [coords, setCoords] = useState<{ left: number; top: number } | null>(null);
  const [interim, setInterimText] = useState("");
  const wordRef = useRef(word); wordRef.current = word;
  const sugsRef = useRef(sugs); sugsRef.current = sugs;
  const hiRef = useRef(hi); hiRef.current = hi;
  const keptRef = useRef<number | null>(null); // position where the player chose "keep as typed"
  const lastCommit = useRef<{ from: number; to: number; roman: string; tail: string } | null>(null);
  const lastDanda = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const pendingId = useRef(0);
  const decoState = useRef({ watch: p.watch ?? [], showLatin: !!p.showLatin, sentenceTicks: !!p.sentenceTicks, romanRange: null as null | { from: number; to: number } });
  decoState.current.watch = p.watch ?? [];
  decoState.current.showLatin = !!p.showLatin;
  decoState.current.sentenceTicks = !!p.sentenceTicks;

  const suggestionsFor = (w: string) => {
    const s = sugsRef.current;
    if (!s || s.word !== w) return null;
    return s.list.length ? s.list : s.fallback ? [s.fallback] : [];
  };

  const ext = useMemo(() => Extension.create({
    name: "hcPlugins",
    addProseMirrorPlugins() {
      return [
        guardPlugin(() => ({ pasteLimit: 40, onBlocked: (k) => props.current.onBlocked?.(k) })),
        decorationsPlugin(() => decoState.current),
        pendingPlugin(),
      ];
    },
  }), []);

  const commit = (ed: Editor, choice: string, tail: string, index: number) => {
    const w = wordRef.current;
    if (!w) return false;
    const { state } = ed.view;
    const tr = state.tr.insertText(choice + tail, w.from, w.to).setMeta(TRUSTED, true);
    ed.view.dispatch(tr);
    lastCommit.current = { from: w.from, to: w.from + choice.length + tail.length, roman: w.text, tail };
    if (tail === "।") lastDanda.current = w.from + choice.length + 1;
    props.current.onXlitAccept?.(index);
    setSugs(null); setWord(null);
    return true;
  };

  /** Space/punctuation before results arrive: insert now, swap in BHASHINI's first suggestion when it lands. */
  const commitAsync = (ed: Editor, tail: string) => {
    const w = wordRef.current!;
    const id = ++pendingId.current;
    const tr = ed.view.state.tr.insertText(tail, w.to).setMeta(TRUSTED, true);
    tr.setMeta(pendingKey, { add: { id, from: w.from, to: w.to, word: w.text } as Pending });
    ed.view.dispatch(tr);
    setWord(null);
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 2500);
    fetchXlit(w.text, ctl.signal).catch(() => ({ suggestions: [], fallback: romanToDevanagari(w.text) })).then((r) => {
      clearTimeout(timer);
      if (ed.isDestroyed) return;
      const st = ed.view.state;
      const pend = (pendingKey.getState(st) ?? []).find((x) => x.id === id);
      if (!pend) return;
      const choice = r.suggestions[0] ?? r.fallback ?? w.text;
      const tr2 = st.tr.setMeta(pendingKey, { remove: id }).setMeta(TRUSTED, true);
      if (st.doc.textBetween(pend.from, pend.to) === pend.word) tr2.insertText(choice, pend.from, pend.to);
      ed.view.dispatch(tr2);
      props.current.onXlitAccept?.(0);
    });
  };

  const editor = useEditor({
    extensions: [Document, Paragraph, Text, History, LockedToken, ext],
    content: toDoc(p.value, p.locked ?? []),
    editable: !p.readOnly,
    editorProps: {
      attributes: {
        autocorrect: "off", autocapitalize: "off", spellcheck: "false", "aria-label": p.ariaLabel, role: "textbox", "aria-multiline": p.singleLine ? "false" : "true",
        lang: "hi", "data-placeholder": p.placeholder ?? "",
      },
      handlePaste: () => { props.current.onBlocked?.("paste"); return true; },
      handleDrop: () => { props.current.onBlocked?.("paste"); return true; },
      handleDOMEvents: {
        copy: (_v, e) => { e.preventDefault(); props.current.onBlocked?.("copy"); return true; },
        cut: (_v, e) => { e.preventDefault(); props.current.onBlocked?.("copy"); return true; },
        contextmenu: (_v, e) => { e.preventDefault(); props.current.onBlocked?.("copy"); return true; },
        dragstart: (_v, e) => { e.preventDefault(); return true; },
        beforeinput: (_v, e) => {
          const it = (e as InputEvent).inputType;
          if (it === "insertFromPaste" || it === "insertFromDrop" || it === "insertFromYank" || it === "insertFromPasteAsQuotation") {
            e.preventDefault(); props.current.onBlocked?.("paste"); return true;
          }
          return false;
        },
        click: (view, e) => {
          const el = (e.target as HTMLElement).closest("[data-watch]") as HTMLElement | null;
          if (!el || !props.current.onWatchClick) return false;
          const pos = view.posAtDOM(el, 0);
          const w = el.dataset.watch!;
          props.current.onWatchClick({ word: w, from: pos, to: pos + w.length, rect: el.getBoundingClientRect() });
          return false;
        },
      },
      handleKeyDown: (view, e) => {
        const ed = editorRef.current!;
        if ((e.ctrlKey || e.metaKey) && ["c", "v", "x"].includes(e.key.toLowerCase())) {
          e.preventDefault(); props.current.onBlocked?.(e.key.toLowerCase() === "v" ? "paste" : "copy"); return true;
        }
        const w = wordRef.current;
        const list = w ? suggestionsFor(w.text) : null;
        if (modeRef.current === "roman" && w) {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            const n = (list?.length ?? 0) + 1;
            setHi((h) => (h + (e.key === "ArrowDown" ? 1 : n - 1)) % n);
            e.preventDefault(); return true;
          }
          if (e.key === "Escape") { keptRef.current = w.to; setWord(null); setSugs(null); e.preventDefault(); return true; }
          if (e.key === "Enter") {
            e.preventDefault();
            const tail = props.current.singleLine ? "" : "\n";
            if (list && list.length) {
              if (hiRef.current >= list.length) { keptRef.current = w.to; setWord(null); }
              else commit(ed, list[hiRef.current], "", hiRef.current);
            } else commitAsync(ed, "");
            if (tail) ed.commands.splitBlock();
            return true;
          }
          if (/^[1-5]$/.test(e.key) && list && list.length) {
            const i = Number(e.key) - 1;
            e.preventDefault();
            if (i < list.length) return commit(ed, list[i], "", i);
            keptRef.current = w.to; setWord(null); setSugs(null); return true;
          }
        }
        if (e.key === "Backspace" && lastCommit.current) {
          const c = lastCommit.current;
          const sel = view.state.selection;
          if (sel.empty && sel.from === c.to) {
            e.preventDefault();
            const tr = view.state.tr.insertText(c.roman, c.from, c.to).setMeta(TRUSTED, true);
            view.dispatch(tr);
            lastCommit.current = null;
            keptRef.current = null;
            return true;
          }
        }
        if (e.key === "Enter" && props.current.singleLine) { e.preventDefault(); return true; }
        if (!["Shift", "Alt", "Control", "Meta"].includes(e.key)) lastCommit.current = e.key === "Backspace" ? null : lastCommit.current;
        return false;
      },
      handleTextInput: (view, from, to, text) => {
        const ed = editorRef.current!;
        const m = modeRef.current;
        props.current.onTyping?.();
        if (m === "inscript") {
          const mapped = [...text].map((ch) => INSCRIPT[ch] ?? ch).join("");
          if (mapped !== text) { view.dispatch(view.state.tr.insertText(mapped, from, to).setMeta(TRUSTED, true)); return true; }
          return false;
        }
        if (m !== "roman") return false;
        const w = wordRef.current;
        if (/^[A-Za-z]$/.test(text)) { lastCommit.current = null; lastDanda.current = null; return false; }
        const prevChar = view.state.doc.textBetween(Math.max(0, from - 1), from);
        if (text === ".") {
          // ".." gives a literal "."; "." between digits is never converted
          if (lastDanda.current === from && prevChar === "।") {
            view.dispatch(view.state.tr.insertText(".", from - 1, from).setMeta(TRUSTED, true));
            lastDanda.current = null;
            return true;
          }
          if (w) {
            const list = suggestionsFor(w.text);
            if (list && list.length && hiRef.current < list.length) return commit(ed, list[hiRef.current], "।", hiRef.current);
            if (keptRef.current === w.to) return false;
            commitAsync(ed, "।");
            lastDanda.current = view.state.selection.from;
            return true;
          }
          if (/\d/.test(prevChar)) return false;
          if (/[ऀ-ॿ]/.test(prevChar)) {
            view.dispatch(view.state.tr.insertText("।", from, to).setMeta(TRUSTED, true));
            lastDanda.current = from + 1;
            return true;
          }
          return false;
        }
        if (w && (text === " " || /^[,;:!?)\]'"\d-]$/.test(text))) {
          if (keptRef.current === w.to) return false;
          const list = suggestionsFor(w.text);
          if (list && list.length) {
            if (hiRef.current >= list.length) { keptRef.current = w.to; return false; }
            return commit(ed, list[hiRef.current], text, hiRef.current);
          }
          commitAsync(ed, text);
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      props.current.onChange(fromDoc(editor.state.doc));
    },
    onSelectionUpdate: ({ editor }) => reportCaret(editor),
    onFocus: () => props.current.onFocus?.(),
  });
  const editorRef = useRef<Editor | null>(null);
  editorRef.current = editor;

  // current Roman word before the caret (roman mode only)
  const recomputeWord = (ed: Editor) => {
    if (modeRef.current !== "roman" || !ed.isEditable) { setWord(null); decoState.current.romanRange = null; return; }
    const { selection, doc } = ed.state;
    if (!selection.empty) { setWord(null); return; }
    const $p = selection.$from;
    const before = $p.parent.textBetween(0, $p.parentOffset, undefined, "￼");
    const m = /[A-Za-z]+$/.exec(before);
    const after = $p.parent.textBetween($p.parentOffset, $p.parent.content.size, undefined, "￼");
    if (!m || /^[A-Za-z]/.test(after) || m[0].length > 30) { setWord(null); decoState.current.romanRange = null; return; }
    const from = selection.from - m[0].length;
    if (keptRef.current === selection.from) { setWord(null); decoState.current.romanRange = null; return; }
    const w = { text: m[0], from, to: selection.from };
    decoState.current.romanRange = { from, to: selection.from };
    setWord((old) => (old && old.text === w.text && old.from === w.from ? old : w));
    void doc;
  };

  const reportCaret = (ed: Editor) => {
    recomputeWord(ed);
    if (props.current.onCaretSentence) {
      const txt = ed.state.doc.textBetween(0, ed.state.selection.from, "\n", "￼");
      props.current.onCaretSentence((txt.match(/[।?!]/g) ?? []).length);
    }
  };

  useEffect(() => {
    if (!editor) return;
    const h = () => recomputeWord(editor);
    editor.on("update", h);
    return () => { editor.off("update", h); };
  }, [editor]);

  // fetch suggestions (150 ms debounce, stale requests aborted)
  useEffect(() => {
    if (!word) { setSugs(null); return; }
    setHi(0);
    const cached = xlitCache.get(word.text.toLowerCase());
    if (cached) { setSugs({ word: word.text, list: cached }); return; }
    const timer = setTimeout(() => {
      abortRef.current?.abort();
      const ctl = new AbortController();
      abortRef.current = ctl;
      fetchXlit(word.text, ctl.signal).then((r) => { if (!ctl.signal.aborted) setSugs({ word: word.text, list: r.suggestions, fallback: r.fallback }); }).catch(() => {});
    }, 150);
    return () => clearTimeout(timer);
  }, [word?.text, word?.from]);

  // popup position at the caret
  useEffect(() => {
    if (!editor || !word) { setCoords(null); return; }
    try {
      const c = editor.view.coordsAtPos(word.to);
      setCoords({ left: c.left, top: c.bottom + 6 });
    } catch { setCoords(null); }
  }, [editor, word, sugs]);

  // external value changes (resume, server re-insert) without clobbering typing
  useEffect(() => {
    if (!editor) return;
    if (fromDoc(editor.state.doc) !== p.value) {
      editor.commands.setContent(toDoc(p.value, p.locked ?? []), false);
      editor.view.dispatch(editor.state.tr.setMeta(ALLOW_LOCKED, true));
    }
  }, [p.value]);

  useEffect(() => { editor?.setEditable(!p.readOnly); }, [p.readOnly, editor]);
  useEffect(() => { if (editor) editor.view.dispatch(editor.state.tr); }, [editor, p.watch?.join("|"), p.showLatin]);
  useEffect(() => { if (mode !== "roman") { setWord(null); setSugs(null); decoState.current.romanRange = null; } }, [mode]);

  useImperativeHandle(ref, () => ({
    insertText(text, _source) {
      if (!editor) return;
      const { from, to } = editor.state.selection;
      const prev = editor.state.doc.textBetween(Math.max(0, from - 1), from);
      const pad = prev && !/\s/.test(prev) && !/^[\s।,.]/.test(text) ? " " : "";
      editor.view.dispatch(editor.state.tr.insertText(pad + text, from, to).setMeta(TRUSTED, true));
      editor.commands.focus();
    },
    replaceRange(from, to, text) {
      if (!editor) return;
      editor.view.dispatch(editor.state.tr.insertText(text, from, to).setMeta(TRUSTED, true));
      editor.commands.focus();
    },
    focus() { editor?.commands.focus(); },
    setInterim(text) { setInterimText(text); },
    backspace() { editor?.commands.keyboardShortcut("Backspace"); },
  }), [editor]);

  const list = word ? suggestionsFor(word.text) : null;
  const showPopup = !!(word && editor?.isFocused && modeRef.current === "roman");
  const touch = isTouch();

  const pick = (i: number) => {
    if (!editor || !word) return;
    if (list && i < list.length) commit(editor, list[i], "", i);
    else { keptRef.current = word.to; setWord(null); setSugs(null); }
    editor.commands.focus();
  };

  const popup = showPopup && (
    <div
      role="listbox"
      aria-label={t("round.xlitHint")}
      onMouseDown={(e) => e.preventDefault()}
      className={touch
        ? "fixed inset-x-0 z-[90] bg-white border-t border-blue-200 shadow-pop px-2 py-1.5 flex gap-1.5 overflow-x-auto"
        : "fixed z-[90] min-w-[190px] rounded-xl bg-white border border-blue-200 shadow-pop py-1 animate-pop"}
      style={touch ? { bottom: `calc(${(window.innerHeight - (window.visualViewport?.height ?? window.innerHeight) - (window.visualViewport?.offsetTop ?? 0))}px)` } : { left: Math.min(coords?.left ?? 0, window.innerWidth - 220), top: coords?.top ?? 0 }}
    >
      {(list ?? []).map((s, i) => (
        <button key={s + i} role="option" aria-selected={hi === i} onClick={() => pick(i)}
          className={touch ? `shrink-0 rounded-lg px-3 py-2 text-[18px] ${hi === i ? "bg-royal-bright text-white" : "bg-royal-soft text-navy"}` : `w-full text-left px-3 py-1.5 text-[18px] flex gap-3 items-center ${hi === i ? "bg-royal-soft" : "hover:bg-gray-50"}`}>
          {!touch && <span className="en text-xs text-muted w-3">{i + 1}</span>}{s}
        </button>
      ))}
      {list === null && <div className={touch ? "px-3 py-2 text-muted" : "px-3 py-1.5 text-muted text-sm"}>…</div>}
      <button role="option" aria-selected={hi === (list?.length ?? 0)} onClick={() => pick(list?.length ?? 0)}
        className={touch ? "shrink-0 rounded-lg px-3 py-2 en text-[16px] bg-gray-100" : `w-full text-left px-3 py-1.5 en text-[15px] flex gap-3 items-center border-t border-gray-100 ${hi === (list?.length ?? 0) ? "bg-royal-soft" : "hover:bg-gray-50"}`}>
        {!touch && <span className="text-xs text-muted w-3">5</span>}{word!.text} <span className="text-xs text-muted">· {t("round.keepAsTyped")}</span>
      </button>
    </div>
  );

  return (
    <div className={`hc-editor ${p.compact ? "compact" : ""} relative`}>
      <EditorContent editor={editor} />
      {!p.value && p.placeholder && <div className="pointer-events-none absolute top-0 left-0 text-gray-400 text-[17px]">{p.placeholder}</div>}
      {interim && <div className="hc-interim mt-1 text-[17px]">{interim}…</div>}
      {popup && createPortal(popup, document.body)}
    </div>
  );
});
