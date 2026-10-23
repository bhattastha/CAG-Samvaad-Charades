import type { RoundKey } from "./config.js";
import { isNumericOnly, numberTokens } from "./text.js";
import type { Field, GlossaryEntry, Part, PartType, PageData, PlantedSlip } from "./types.js";

/** Glossary row as stored in seed/*.json. */
export interface SeedTerm {
  english_term: string;
  hindi_term: string;
  accepted_variants?: string[];
  avoid_forms?: string[];
}
export const toEntry = (t: SeedTerm): GlossaryEntry => ({
  en: t.english_term.trim(),
  hi: t.hindi_term.trim(),
  variants: t.accepted_variants ?? [],
  avoid: t.avoid_forms ?? [],
});

interface SeedText { en: string; hi_reference?: string; bhashini_draft?: string | null; numeric?: boolean; locked_tokens?: string[] }
interface SeedPart {
  part_id: string;
  type: PartType;
  tick_group: string | null;
  en?: string;
  hi_reference?: string;
  bhashini_draft?: string | null;
  locked_tokens?: string[];
  editable?: boolean;
  layout?: any;
  page_no?: number;
}
export interface SeedPage {
  page_id: string;
  round: RoundKey;
  label?: string;
  source?: { printed_page?: string; sector_hidden_from_player?: string; [k: string]: unknown };
  segments?: { segment_id: string; paragraph?: number; en: string; hi_reference: string; bhashini_draft: string | null; locked_tokens: string[] }[];
  parts?: SeedPart[];
  planted_slips?: { part_id: string; kind: PlantedSlip["kind"]; wrong_text: string; en_term?: string | null; fix_hint: string }[];
  glossary_terms?: SeedTerm[];
}

function field(key: string, t: SeedText | undefined, fallbackLocked: string[] = []): Field | null {
  if (!t || (!t.en && !t.hi_reference)) return null;
  const numeric = !!t.numeric || isNumericOnly(t.en);
  return {
    key,
    en: t.en,
    hiReference: numeric ? t.en : (t.hi_reference ?? ""),
    draft: numeric ? t.en : (t.bhashini_draft ?? null),
    locked: numeric ? [t.en] : t.locked_tokens ?? (fallbackLocked.length ? fallbackLocked : numberTokens(t.en)),
    numeric,
  };
}

function tableFields(layout: any): { fields: Field[]; rows: string[][] } {
  const fields: Field[] = [];
  const rows: string[][] = [];
  const push = (key: string, t: SeedText | undefined) => {
    const f = field(key, t);
    if (f) fields.push(f);
    return f ? key : "";
  };
  if (layout?.columns) rows.push(layout.columns.map((c: SeedText, i: number) => push(`h${i}`, c)));
  (layout?.rows ?? []).forEach((r: SeedText[], ri: number) => rows.push(r.map((c, ci) => push(`r${ri}c${ci}`, c))));
  return { fields, rows };
}

/** Convert a seed page file (trial "segments" or structured "parts") into PageData. */
export function seedToPage(s: SeedPage): { page: PageData; sector: string } {
  const parts: Part[] = [];
  if (s.segments?.length) {
    const paras = new Map<number, string[]>();
    for (const seg of s.segments) paras.set(seg.paragraph ?? 1, [...(paras.get(seg.paragraph ?? 1) ?? []), seg.en]);
    parts.push({
      id: "passage",
      order: 0,
      type: "passage",
      tickGroup: null,
      editable: true,
      layout: null,
      enSentences: s.segments.map((x) => x.en),
      fields: [{
        key: "t",
        en: [...paras.values()].map((p) => p.join(" ")).join("\n\n"),
        hiReference: s.segments.map((x) => x.hi_reference).join(" "),
        draft: null,
        locked: [...new Set(s.segments.flatMap((x) => x.locked_tokens))],
        numeric: false,
      }],
    });
  }
  (s.parts ?? []).forEach((p, i) => {
    const editable = p.editable !== false && p.type !== "page_number";
    const base = { id: p.part_id, order: i + 1, type: p.type, tickGroup: editable ? p.tick_group : null, editable, ...(p.page_no ? { pageNo: p.page_no } : {}) };
    if (p.type === "table") {
      const L = p.layout ?? {};
      const { fields, rows } = tableFields(L);
      const title = field("title", L.title);
      const note = field("note", L.note);
      parts.push({ ...base, layout: { kind: "table", rows, title: title ? "title" : undefined, note: note ? "note" : undefined }, fields: [title, ...fields, note].filter(Boolean) as Field[] });
    } else if (p.type === "chart") {
      const L = p.layout ?? {};
      const fields: Field[] = [];
      const add = (k: string, t: SeedText | undefined) => { const f = field(k, t); if (f) fields.push(f); return f ? k : undefined; };
      const title = add("title", L.title);
      const xLabels = (L.xLabels ?? []).map((x: SeedText, i: number) => add(`x${i}`, x) ?? "");
      const series = (L.series ?? []).map((sr: any, i: number) => ({ name: add(`s${i}`, sr.name), values: sr.values ?? [] }));
      const yAxis = add("y", L.yAxis ?? undefined);
      const source = add("source", L.source ?? undefined);
      parts.push({ ...base, layout: { kind: "chart", chart: L.kind ?? "bar", title, xLabels, series, yAxis, source, yTicks: L.yTicks, valueDecimals: L.valueDecimals }, fields });
    } else {
      const f = field("t", { en: p.en ?? "", hi_reference: p.hi_reference, bhashini_draft: p.bhashini_draft }, p.locked_tokens ?? []);
      parts.push({ ...base, layout: null, fields: f ? [{ ...f, numeric: p.type === "page_number" || f.numeric }] : [] });
    }
  });
  return {
    sector: String(s.source?.sector_hidden_from_player ?? ""),
    page: {
      id: s.page_id,
      roundKey: s.round,
      label: s.label ?? s.page_id,
      printedPageNo: s.source?.printed_page ?? null,
      parts,
      terms: (s.glossary_terms ?? []).map(toEntry),
      slips: (s.planted_slips ?? []).map((x) => ({ partId: x.part_id, kind: x.kind, wrongText: x.wrong_text, enTerm: x.en_term ?? null, fixHint: x.fix_hint })),
    },
  };
}

/** What the browser may see of a page: no hiReference, no sector, no slip fixes (§14). */
export function clientPage(page: PageData) {
  return {
    id: page.id,
    roundKey: page.roundKey,
    label: page.label,
    printedPageNo: page.printedPageNo,
    parts: page.parts.map((p) => ({ ...p, fields: p.fields.map(({ hiReference: _h, ...f }) => f) })),
  };
}
export type ClientPage = ReturnType<typeof clientPage>;
