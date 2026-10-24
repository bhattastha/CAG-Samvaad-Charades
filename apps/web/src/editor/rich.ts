import { Extension, Mark, mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";

/**
 * Word-like formatting for the Hindi editors. Formatting lives in the document (and is saved as a parallel `html`
 * value); the plain text that scoring reads is always re-derived from the text nodes only (`fromDoc`), so none of
 * this can change a score. Underline and text-align are small local extensions because the matching TipTap
 * packages are not in the offline store.
 */
export const Underline = Mark.create({
  name: "underline",
  parseHTML() { return [{ tag: "u" }, { style: "text-decoration", consuming: false, getAttrs: (v) => (/underline/.test(String(v)) ? {} : false) }]; },
  renderHTML({ HTMLAttributes }) { return ["u", mergeAttributes(HTMLAttributes), 0]; },
  addCommands() {
    return {
      toggleUnderline: () => ({ commands }: any) => commands.toggleMark(this.name),
    } as any;
  },
  addKeyboardShortcuts() { return { "Mod-u": () => (this.editor.commands as any).toggleUnderline() }; },
});

export type Align = "left" | "center" | "right" | "justify";

export const TextAlign = Extension.create({
  name: "textAlign",
  addGlobalAttributes() {
    return [{
      types: ["paragraph", "heading"],
      attributes: {
        textAlign: {
          default: null,
          parseHTML: (el: HTMLElement) => (["left", "center", "right", "justify"].includes(el.style.textAlign) ? el.style.textAlign : null),
          renderHTML: (a: { textAlign?: string | null }) => (a.textAlign ? { style: `text-align: ${a.textAlign}` } : {}),
        },
      },
    }];
  },
  addCommands() {
    return {
      setTextAlign: (align: Align) => ({ commands }: any) => ["paragraph", "heading"].map((n) => commands.updateAttributes(n, { textAlign: align })).some(Boolean),
    } as any;
  },
});

/**
 * Extension set for a rich editor. Block formatting (headings, lists, alignment) is for multi-line fields; single-line
 * fields (table cells, labels) keep only the character marks. StarterKit supplies Document, Paragraph, Text, History,
 * Bold, Italic, Heading and the lists; everything that could carry content out of the page is switched off.
 */
export const richExtensions = (singleLine: boolean) => [
  StarterKit.configure({
    blockquote: false, codeBlock: false, code: false, strike: false, horizontalRule: false, hardBreak: false, dropcursor: false, gapcursor: false,
    heading: singleLine ? false : { levels: [1, 2] },
    bulletList: singleLine ? false : undefined,
    orderedList: singleLine ? false : undefined,
    listItem: singleLine ? false : undefined,
  }),
  Underline,
  ...(singleLine ? [] : [TextAlign]),
];

/** Does an HTML string carry formatting worth saving? (plain paragraphs are not stored) */
export const hasFormatting = (html: string) => /<(strong|em|u|h[1-3]|ul|ol)\b|text-align:\s*(center|right|justify)/.test(html);
