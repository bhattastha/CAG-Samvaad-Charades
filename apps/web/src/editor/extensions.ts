import { Node, mergeAttributes } from "@tiptap/core";
import { Plugin, PluginKey, type EditorState, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";
import { escapeRegExp } from "@hc/shared";

/** Meta flags on transactions. */
export const TRUSTED = "hcTrusted"; // helper, glossary, ASR, programmatic: exempt from the > 40-char paste rule
export const ALLOW_LOCKED = "hcAllowLocked"; // setContent only

/** Atomic, undeletable number chip (§12 "Locked numbers"). */
export const LockedToken = Node.create({
  name: "lockedToken",
  inline: true,
  group: "inline",
  atom: true,
  selectable: false,
  draggable: false,
  addAttributes() {
    return { value: { default: "" } };
  },
  parseHTML() {
    return [{ tag: "span[data-locked]", getAttrs: (el) => ({ value: (el as HTMLElement).dataset.locked }) }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-locked": node.attrs.value, class: "hc-lock", contenteditable: "false", title: "🔒" }), node.attrs.value];
  },
  renderText({ node }) {
    return node.attrs.value;
  },
});

const lockedValues = (doc: PMNode) => {
  const m = new Map<string, number>();
  doc.descendants((n) => {
    if (n.type.name === "lockedToken") m.set(n.attrs.value, (m.get(n.attrs.value) ?? 0) + 1);
  });
  return m;
};

function insertedChars(tr: Transaction): number {
  let n = 0;
  for (const step of tr.steps as any[]) {
    const slice = step.slice;
    if (slice?.content) n += slice.content.textBetween(0, slice.content.size, "\n", " ").length;
  }
  return n;
}

export interface GuardOpts {
  onBlocked: (kind: "paste" | "locked") => void;
  pasteLimit: number;
}

/** Rejects deleting/changing locked chips and big untrusted inserts (treated as paste). */
export function guardPlugin(get: () => GuardOpts) {
  return new Plugin({
    key: new PluginKey("hcGuard"),
    filterTransaction(tr, state) {
      if (!tr.docChanged || tr.getMeta(ALLOW_LOCKED)) return true;
      const before = lockedValues(state.doc);
      if (before.size) {
        const after = lockedValues(tr.doc);
        for (const [v, c] of before) if ((after.get(v) ?? 0) < c) { queueMicrotask(() => get().onBlocked("locked")); return false; }
      }
      if (!tr.getMeta(TRUSTED) && !tr.getMeta("composition") && insertedChars(tr) > get().pasteLimit && !tr.getMeta("history$")) {
        queueMicrotask(() => get().onBlocked("paste"));
        return false;
      }
      return true;
    },
  });
}

export interface DecoOpts {
  watch: string[];
  showLatin: boolean;
  sentenceTicks: boolean;
  romanRange: { from: number; to: number } | null;
}

const DEVA_WORD_CHAR = /[ऀ-ॿ]/;

/** Highlights: current Roman word, watch words (avoid forms / slips), Latin words, finished-sentence ticks. */
export function decorationsPlugin(get: () => DecoOpts) {
  return new Plugin({
    key: new PluginKey("hcDeco"),
    props: {
      decorations(state: EditorState) {
        const o = get();
        const decos: Decoration[] = [];
        const watchRe = o.watch.length ? new RegExp(o.watch.filter(Boolean).sort((a, b) => b.length - a.length).map(escapeRegExp).join("|"), "g") : null;
        state.doc.descendants((node, pos) => {
          if (!node.isTextblock) return;
          // collect text with positions (atoms count as one position)
          let text = "";
          const map: number[] = [];
          node.forEach((child, offset) => {
            const start = pos + 1 + offset;
            if (child.isText) {
              for (let i = 0; i < child.text!.length; i++) { text += child.text![i]; map.push(start + i); }
            } else { text += "￼"; map.push(start); }
          });
          const at = (i: number) => (i < map.length ? map[i] : (map[map.length - 1] ?? pos + 1) + 1);
          if (watchRe) {
            for (const m of text.matchAll(watchRe)) {
              // whole-word-ish: don't flag inside a longer Devanagari word start
              const prev = text[m.index! - 1];
              if (prev && DEVA_WORD_CHAR.test(prev) && !/\s/.test(prev)) continue;
              decos.push(Decoration.inline(at(m.index!), at(m.index! + m[0].length), { class: "hc-watch", "data-watch": m[0] }));
            }
          }
          if (o.showLatin) {
            for (const m of text.matchAll(/[A-Za-z]+/g)) {
              const from = at(m.index!), to = at(m.index! + m[0].length);
              if (o.romanRange && from === o.romanRange.from) continue;
              decos.push(Decoration.inline(from, to, { class: "hc-latin" }));
            }
          }
          if (o.sentenceTicks) {
            let start = 0;
            for (let i = 0; i < text.length; i++) {
              if ("।?!".includes(text[i])) {
                const sentence = text.slice(start, i).trim();
                if (sentence.split(/\s+/).filter(Boolean).length >= 2) {
                  let s = start;
                  while (s < i && /\s/.test(text[s])) s++;
                  decos.push(Decoration.widget(at(s), () => { const el = document.createElement("span"); el.className = "hc-done-mark"; el.textContent = "✓"; el.setAttribute("aria-hidden", "true"); return el; }, { side: -1, key: `tick-${s}` }));
                }
                start = i + 1;
              }
            }
          }
        });
        if (o.romanRange && o.romanRange.to > o.romanRange.from) decos.push(Decoration.inline(o.romanRange.from, o.romanRange.to, { class: "hc-roman" }));
        return DecorationSet.create(state.doc, decos);
      },
    },
  });
}

/** Tracks ranges whose transliteration is still being fetched, mapped through later edits. */
export interface Pending { id: number; from: number; to: number; word: string }
export const pendingKey = new PluginKey<Pending[]>("hcPending");
export function pendingPlugin() {
  return new Plugin<Pending[]>({
    key: pendingKey,
    state: {
      init: () => [],
      apply(tr, value) {
        let next = value.map((p) => ({ ...p, from: tr.mapping.map(p.from, 1), to: tr.mapping.map(p.to, -1) })).filter((p) => p.to > p.from);
        const add = tr.getMeta(pendingKey) as { add?: Pending; remove?: number } | undefined;
        if (add?.add) next = [...next, add.add];
        if (add?.remove !== undefined) next = next.filter((p) => p.id !== add.remove);
        return next;
      },
    },
  });
}

// ---------- string ⇄ doc ----------

export function toDoc(text: string, locked: string[]) {
  const toks = [...new Set(locked)].filter(Boolean).sort((a, b) => b.length - a.length);
  const re = toks.length ? new RegExp(`(${toks.map(escapeRegExp).join("|")})`, "g") : null;
  const paras = (text ?? "").split("\n");
  return {
    type: "doc",
    content: paras.map((p) => {
      const content: any[] = [];
      if (!re) { if (p) content.push({ type: "text", text: p }); }
      else {
        let last = 0;
        for (const m of p.matchAll(re)) {
          // a token only becomes a chip when it is a whole number (not part of a longer one)
          const before = p[m.index! - 1], after = p[m.index! + m[0].length];
          if ((before && /[\d.,]/.test(before)) || (after && /\d/.test(after))) continue;
          if (m.index! > last) content.push({ type: "text", text: p.slice(last, m.index) });
          content.push({ type: "lockedToken", attrs: { value: m[0] } });
          last = m.index! + m[0].length;
        }
        if (last < p.length) content.push({ type: "text", text: p.slice(last) });
      }
      return { type: "paragraph", content };
    }),
  };
}

export function fromDoc(doc: PMNode): string {
  const out: string[] = [];
  doc.forEach((para) => {
    let s = "";
    para.forEach((c) => { s += c.isText ? c.text : c.type.name === "lockedToken" ? c.attrs.value : ""; });
    out.push(s);
  });
  return out.join("\n");
}
