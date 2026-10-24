import { useEffect, useReducer, type ReactNode } from "react";
import type { Editor } from "@tiptap/react";
import { t } from "../lib/strings";
import type { Align } from "./rich";

const G: Record<string, string> = {
  bullets: "M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01",
  numbers: "M10 6h10M10 12h10M10 18h10M3.5 4.8l1.5-.8v4.2M3.4 12.2c0-1.2 2.2-1.2 2.2 0 0 1-2.2 1.6-2.2 2.8h2.3M3.4 18.2h2.1l-1.2 1.4c1.2-.2 1.5 1.8 0 1.8-.6 0-1-.2-1.1-.6",
  left: "M4 6h16M4 10h10M4 14h16M4 18h10",
  center: "M4 6h16M7 10h10M4 14h16M7 18h10",
  justify: "M4 6h16M4 10h16M4 14h16M4 18h16",
  undo: "M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 010 11H11",
  redo: "M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 000 11H13",
};
const Glyph = ({ d }: { d: string }) => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>;

/**
 * One formatting toolbar for the translation pane (Word-like). It acts on the segment editor that last had focus and
 * never takes focus itself, so typing, the locked-number chips and the paste guard are untouched.
 */
export function FormatToolbar({ editor, disabled, children }: { editor: Editor | null; disabled?: boolean; children?: ReactNode }) {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (!editor) return;
    editor.on("transaction", bump);
    editor.on("focus", bump);
    return () => { editor.off("transaction", bump); editor.off("focus", bump); };
  }, [editor]);
  const live = editor && !editor.isDestroyed ? editor : null;
  const off = !live || !!disabled || !live.isEditable;
  const nodes = live?.schema.nodes ?? {};
  const block = !!nodes.heading;
  const run = (fn: (c: any) => any) => { if (live && !off) fn(live.chain().focus()).run(); };
  const alignOf = (live?.getAttributes("paragraph").textAlign ?? live?.getAttributes("heading").textAlign ?? "left") as Align;

  const btn = (key: string, label: string, active: boolean, onClick: () => void, content: ReactNode, skip = false) => (
    <button key={key} type="button" aria-label={label} title={label} aria-pressed={active} disabled={off || skip}
      onMouseDown={(e) => e.preventDefault()} onClick={onClick}
      className={`h-8 min-w-8 px-1.5 rounded-md grid place-items-center text-[14px] transition disabled:opacity-35 disabled:cursor-not-allowed ${active ? "bg-navy text-white" : "text-navy hover:bg-slate-100"}`}>
      {content}
    </button>
  );
  const sep = (k: string) => <span key={k} className="w-px h-5 bg-slate-200 mx-1 shrink-0" aria-hidden />;
  const is = (n: string, a?: any) => !!live && live.isActive(n, a);

  return (
    <div role="toolbar" aria-label={t("round.toolbar.label")} className="flex items-center gap-0.5 overflow-x-auto min-w-0" onMouseDown={(e) => { if ((e.target as HTMLElement).tagName !== "SELECT") e.preventDefault(); }}>
      {btn("b", t("round.toolbar.bold"), is("bold"), () => run((c) => c.toggleBold()), <span className="font-extrabold en">B</span>)}
      {btn("i", t("round.toolbar.italic"), is("italic"), () => run((c) => c.toggleItalic()), <span className="italic font-semibold en">I</span>)}
      {btn("u", t("round.toolbar.underline"), is("underline"), () => run((c) => c.toggleUnderline()), <span className="underline font-semibold en">U</span>)}
      {sep("s1")}
      {btn("h1", t("round.toolbar.h1"), is("heading", { level: 1 }), () => run((c) => c.toggleHeading({ level: 1 })), <span className="font-bold en text-[13px]">H1</span>, !block)}
      {btn("h2", t("round.toolbar.h2"), is("heading", { level: 2 }), () => run((c) => c.toggleHeading({ level: 2 })), <span className="font-bold en text-[13px]">H2</span>, !block)}
      {btn("p", t("round.toolbar.normal"), block && is("paragraph"), () => run((c) => c.setParagraph()), <span className="en text-[13px] font-semibold">¶</span>, !block)}
      {sep("s2")}
      {btn("ul", t("round.toolbar.bullets"), is("bulletList"), () => run((c) => c.toggleBulletList()), <Glyph d={G.bullets} />, !block)}
      {btn("ol", t("round.toolbar.numbers"), is("orderedList"), () => run((c) => c.toggleOrderedList()), <Glyph d={G.numbers} />, !block)}
      {sep("s3")}
      {(["left", "center", "justify"] as Align[]).map((a) => btn(a, t(`round.toolbar.${a}`), block && alignOf === a, () => run((c) => c.setTextAlign(a)), <Glyph d={G[a]} />, !block))}
      {sep("s4")}
      {btn("undo", t("round.toolbar.undo"), false, () => run((c) => c.undo()), <Glyph d={G.undo} />)}
      {btn("redo", t("round.toolbar.redo"), false, () => run((c) => c.redo()), <Glyph d={G.redo} />)}
      {children}
    </div>
  );
}
