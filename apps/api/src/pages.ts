import {
  applyOverrides, clientPage, containsHindi, matchSourceTerms, normalise,
  type GlossaryEntry, type PageData, type Part,
} from "@hc/shared";
import type { Db } from "./db.js";

// ---------------- glossary index (in memory; ~11k entries) ----------------

let glossary: { all: GlossaryEntry[]; byEn: Map<string, GlossaryEntry>; allByEn: Map<string, GlossaryEntry>; overrides: GlossaryEntry[] } | null = null;
const STOP = new Set(["and", "the", "for", "from", "with", "also", "such", "this", "that", "these", "those", "into", "upon", "over", "under"]);

export async function loadGlossary(db: Db) {
  const rows = await db.query<{ en: string; hi: string; accepted_variants: string[]; avoid_forms: string[]; flags: string[]; override: any }>(
    "SELECT en, hi, accepted_variants, avoid_forms, flags, override FROM glossary_terms",
  );
  const all: GlossaryEntry[] = [];
  const overrides: GlossaryEntry[] = [];
  const byEn = new Map<string, GlossaryEntry>();
  const allByEn = new Map<string, GlossaryEntry>();
  for (const r of rows) {
    if (r.flags.includes("empty_primary_after_cleaning")) continue;
    const ov = r.override && r.override.active !== false ? r.override : null;
    const e: GlossaryEntry = ov
      ? { en: r.en, hi: ov.hi, variants: ov.variants ?? [], avoid: ov.avoid ?? [] }
      : { en: r.en, hi: r.hi, variants: (r.accepted_variants ?? []).filter((v) => !/^\d+$/.test(v)), avoid: r.avoid_forms ?? [] };
    if (ov) overrides.push(e);
    all.push(e);
    const k = r.en.toLowerCase().replace(/’/g, "'").replace(/\s+/g, " ").trim();
    // inline source underlines: multi-word terms, and longer single words whose Hindi is a real
    // term (not a transliteration) — so the page is not drowned in dashes
    const multi = k.includes(" ");
    const strong = multi ? k.length >= 6 : k.length >= 8 && !r.flags.includes("primary_looks_transliterated");
    if (strong && !STOP.has(k)) byEn.set(k, e);
    allByEn.set(k, e);
  }
  glossary = { all, byEn, allByEn, overrides };
  pageCache.clear();
}
export const glossaryIndex = () => glossary!;

export function searchGlossary(q: string, limit = 25): GlossaryEntry[] {
  const g = glossary!;
  const s = normalise(q).toLowerCase();
  if (!s) return [];
  const starts: GlossaryEntry[] = [];
  const contains: GlossaryEntry[] = [];
  for (const e of g.all) {
    const en = e.en.toLowerCase();
    const hit = en.startsWith(s) || e.hi.startsWith(s) ? 1 : en.includes(s) || e.hi.includes(s) || e.variants.some((v) => v.includes(s)) ? 2 : 0;
    if (hit === 1) starts.push(e);
    else if (hit === 2) contains.push(e);
    if (starts.length >= limit) break;
  }
  return [...starts.sort((a, b) => a.en.length - b.en.length), ...contains.sort((a, b) => a.en.length - b.en.length)].slice(0, limit);
}

// ---------------- pages ----------------

const pageCache = new Map<string, { version: number; page: PageData; sector: string; extras: PageExtras }>();

/** Per-field glossary matches in the English, and words worth a second look in the Hindi draft. */
export interface PageExtras {
  sourceTerms: Record<string, Record<string, { start: number; end: number; en: string; hi: string; variants: string[]; avoid: string[] }[]>>;
  watchWords: { text: string; kind: "avoid" | "slip"; en?: string; hi?: string; options?: string[] }[];
}

function computeExtras(page: PageData): PageExtras {
  const g = glossary!;
  const refAll = page.parts.flatMap((p) => p.fields.map((f) => f.hiReference)).join(" ");
  const sourceTerms: PageExtras["sourceTerms"] = {};
  const watch = new Map<string, PageExtras["watchWords"][number]>();
  const addAvoid = (e: GlossaryEntry) => {
    for (const a of e.avoid) {
      // never flag a form CAG's own Hindi uses (the seed split is automatic and sometimes wrong)
      if (a.length < 2 || /[A-Za-z]/.test(a) || containsHindi(refAll, a)) continue;
      if (!watch.has(a)) watch.set(a, { text: a, kind: "avoid", en: e.en, hi: e.hi, options: [e.hi, ...e.variants].slice(0, 5) });
    }
  };
  const index = new Map(g.byEn);
  for (const t of page.terms) index.set(t.en.toLowerCase(), t);
  for (const p of page.parts) {
    for (const f of p.fields) {
      if (f.numeric || !f.en) continue;
      const m = matchSourceTerms(f.en, index).map(({ start, end, entry }) => ({ start, end, en: entry.en, hi: entry.hi, variants: entry.variants.slice(0, 4), avoid: entry.avoid.slice(0, 4) }));
      if (m.length) (sourceTerms[p.id] ??= {})[f.key] = m;
      m.forEach((x) => addAvoid({ en: x.en, hi: x.hi, variants: x.variants, avoid: x.avoid }));
    }
  }
  page.terms.forEach(addAvoid);
  for (const s of page.slips) if (!watch.has(s.wrongText)) watch.set(s.wrongText, { text: s.wrongText, kind: "slip", en: s.enTerm ?? undefined });
  return { sourceTerms, watchWords: [...watch.values()] };
}

export async function loadPage(db: Db, id: string): Promise<{ page: PageData; sector: string; extras: PageExtras } | null> {
  const row = await db.one<any>("SELECT * FROM pages WHERE id=$1", [id]);
  if (!row) return null;
  const c = pageCache.get(id);
  if (c && c.version === row.version) return c;
  const parts = await db.query<any>("SELECT * FROM page_parts WHERE page_id=$1 ORDER BY ord", [id]);
  const slips = await db.query<any>("SELECT * FROM planted_slips WHERE page_id=$1 ORDER BY id", [id]);
  const terms = await db.query<any>("SELECT * FROM page_terms WHERE page_id=$1 ORDER BY ord", [id]);
  const page: PageData = {
    id: row.id,
    roundKey: row.round_key,
    label: row.label,
    printedPageNo: row.printed_page_no,
    parts: parts.map((p): Part => ({
      id: p.id, order: p.ord, type: p.type, tickGroup: p.tick_group, editable: p.editable, layout: p.layout,
      fields: p.fields, ...(p.en_sentences ? { enSentences: p.en_sentences } : {}),
    })),
    slips: slips.map((s) => ({ partId: s.part_id, kind: s.kind, wrongText: s.wrong_text, enTerm: s.en_term, fixHint: s.fix_hint })),
    terms: applyOverrides(terms.map((t) => ({ en: t.en, hi: t.hi, variants: t.variants, avoid: t.avoid })), glossary?.overrides ?? []),
  };
  const v = { version: row.version, page, sector: row.sector, extras: computeExtras(page) };
  pageCache.set(id, v);
  return v;
}
export const invalidatePage = (id: string) => pageCache.delete(id);

/** The page as the player may see it: no reference, sector or slip fixes (§14). */
export function playerPage(p: { page: PageData; extras: PageExtras }, sample: boolean) {
  return { ...clientPage(p.page), sample, sourceTerms: p.extras.sourceTerms, watchWords: p.extras.watchWords.map(({ kind: _k, ...w }) => ({ ...w })) };
}

export async function savePage(db: Db, page: PageData, opts: { sector: string; source?: unknown; status?: string; sample?: boolean; verified?: boolean }) {
  await db.tx(async (q) => {
    const existing = await q.one<{ version: number }>("SELECT version FROM pages WHERE id=$1", [page.id]);
    if (existing) {
      await q.query("UPDATE pages SET round_key=$2, label=$3, printed_page_no=$4, sector=$5, source=$6, status=COALESCE($7,status), sample=$8, version=version+1 WHERE id=$1",
        [page.id, page.roundKey, page.label, page.printedPageNo, opts.sector, JSON.stringify(opts.source ?? {}), opts.status ?? null, !!opts.sample]);
    } else {
      await q.query("INSERT INTO pages (id, round_key, label, printed_page_no, sector, source, status, sample) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
        [page.id, page.roundKey, page.label, page.printedPageNo, opts.sector, JSON.stringify(opts.source ?? {}), opts.status ?? "draft", !!opts.sample]);
    }
    const verified = new Map((await q.query<{ id: string; reference_verified: boolean }>("SELECT id, reference_verified FROM page_parts WHERE page_id=$1", [page.id])).map((r) => [r.id, r.reference_verified]));
    await q.query("DELETE FROM page_parts WHERE page_id=$1", [page.id]);
    for (const p of page.parts) {
      await q.query("INSERT INTO page_parts (id, page_id, ord, type, tick_group, editable, layout, fields, en_sentences, reference_verified) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
        [p.id, page.id, p.order, p.type, p.tickGroup, p.editable, JSON.stringify(p.layout), JSON.stringify(p.fields), p.enSentences ? JSON.stringify(p.enSentences) : null, opts.verified ?? verified.get(p.id) ?? false]);
    }
    await q.query("DELETE FROM planted_slips WHERE page_id=$1", [page.id]);
    for (const s of page.slips)
      await q.query("INSERT INTO planted_slips (page_id, part_id, kind, wrong_text, en_term, fix_hint) VALUES ($1,$2,$3,$4,$5,$6)", [page.id, s.partId, s.kind, s.wrongText, s.enTerm, s.fixHint]);
    await q.query("DELETE FROM page_terms WHERE page_id=$1", [page.id]);
    let i = 0;
    for (const t of page.terms)
      await q.query("INSERT INTO page_terms (page_id, ord, en, hi, variants, avoid) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING", [page.id, i++, t.en, t.hi, t.variants, t.avoid]);
  });
  invalidatePage(page.id);
}
