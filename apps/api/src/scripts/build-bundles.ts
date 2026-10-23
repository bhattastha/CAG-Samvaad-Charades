/**
 * Build the 10 / 20 / 30-page report bundles (Primary / Secondary / Pro) from the transcribed page files in
 * scripts/content/work/<bundle>/page_<pdf>.json (English from the text layer, CAG's Hindi read from the page images).
 *
 *   corepack pnpm --filter @hc/api exec tsx src/scripts/build-bundles.ts [--no-draft]
 *
 * Drafts come from the Anuvaad pipeline (numbers masked), cached in work/drafts.json so reruns are free.
 * Glossary terms are found with the Anuvaad matching algorithm and kept only when CAG's Hindi uses them.
 * Writes seed/pages/<bundle>_r38_bundle.json and copies figure crops to apps/web/public/figures/.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { containsHindi, glossaryKey, inflections, isNumericOnly, matchSourceTerms, numberTokens, type GlossaryEntry } from "@hc/shared";
import { ROOT } from "../env.js";
import { translateBatch } from "../bhashini/client.js";

const WORK = resolve(ROOT, "scripts/content/work");
const FIG_OUT = resolve(ROOT, "apps/web/public/figures");
const noDraft = process.argv.includes("--no-draft");

const BUNDLES: { key: "primary" | "secondary" | "pro"; pages: number[]; terms: number; label: string }[] = [
  { key: "primary", pages: [12, 13, 14, 15, 16, 27, 28, 85, 86, 87], terms: 16, label: "Executive Summary (pp. vi–x), Chapter II (pp. 7–8), Chapter VI (pp. 57–59)" },
  { key: "secondary", pages: [58, 59, 60, 61, 62, 63, 64, 65, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 81, 82], terms: 24, label: "Chapter IV (pp. 34–41), Chapter V (pp. 43–52), Chapter VI (pp. 53–54)" },
  { key: "pro", pages: [19, 20, 21, 22, 23, 24, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57], terms: 32, label: "Chapter I (pp. 1–6), Chapter III (pp. 9–19), Chapter IV (pp. 21–33)" },
];

type Txt = { en: string; hi_reference?: string; bhashini_draft?: string | null; numeric?: boolean };
const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));

// ---------- glossary (seed file; same normaliser as the game) ----------
const STOP = new Set(["and", "the", "for", "from", "with", "also", "such", "this", "that", "these", "those", "into", "upon", "over", "under", "was", "were", "has", "have", "per", "cent", "not", "all", "any"]);
const gl = (read(resolve(ROOT, "seed/glossary.json")) as any[]).filter((g) => !g.sector);
const index = new Map<string, GlossaryEntry & { flags: string[] }>();
for (const g of gl) {
  const k = glossaryKey(g.english_term);
  if (!k || STOP.has(k) || k.length < 4 || /^\d/.test(k) || g.flags?.includes("primary_looks_transliterated") || g.flags?.includes("empty_primary_after_cleaning")) continue;
  if (!index.has(k)) index.set(k, { en: g.english_term, hi: g.hindi_term, variants: g.accepted_variants ?? [], avoid: g.avoid_forms ?? [], flags: g.flags ?? [] });
}

const FUNCTION_WORDS = new Set(["in", "as", "on", "at", "by", "of", "to", "that", "from", "during", "set", "laid", "related", "adhere", "handing", "leading", "with", "within", "per", "under", "over", "after", "before", "due", "owing", "subject", "make", "take", "carry", "put", "high", "least", "time", "such", "it", "there", "this"]);

const GENERIC = new Set(["year", "years", "days", "day", "fact", "further", "solid", "source", "rate", "level", "period", "actual", "fixed", "percentage", "power", "business", "plan", "increase", "loss", "achieve", "hours", "month", "total", "number", "time", "shop", "volume", "yield", "norm", "materials", "perspective", "safety", "against", "except", "entire", "months", "required", "available", "extra", "crude", "specific"]);

// ---------- drafts cache ----------
const cachePath = resolve(WORK, "drafts.json");
const cache: Record<string, string> = existsSync(cachePath) ? read(cachePath) : {};

function texts(part: any): Txt[] {
  if (part.type === "table") {
    const L = part.layout ?? {};
    return [L.title, L.unit, ...(L.columns ?? []), ...(L.rows ?? []).flat(), L.note].filter(Boolean);
  }
  if (part.type === "figure") {
    const L = part.layout ?? {};
    return [L.title, ...(L.labels ?? []), L.source].filter(Boolean);
  }
  return part.en ? [part as Txt] : [];
}
const needsWords = (t: Txt) => !!t.en && !t.numeric && !isNumericOnly(t.en) && /[A-Za-z]{2,}/.test(t.en);

async function build(b: (typeof BUNDLES)[number]) {
  const parts: any[] = [];
  let g = 0;
  const printed: string[] = [];
  b.pages.forEach((pdf, i) => {
    const pg = read(resolve(WORK, b.key, `page_${pdf}.json`));
    const pageNo = i + 1;
    printed.push(String(pg.printed_page ?? pdf));
    (pg.parts as any[]).forEach((p, n) => {
      const id = `p${pdf}_${String(n + 1).padStart(2, "0")}`;
      const out: any = { part_id: id, type: p.type, page_no: pageNo };
      if (p.type === "page_number") {
        Object.assign(out, { tick_group: null, en: String(p.en || pg.printed_page || ""), editable: false });
      } else if (p.type === "table" || p.type === "figure") {
        out.tick_group = `g${++g}`;
        out.layout = structuredClone(p.layout);
        if (p.type === "figure" && out.layout.image) {
          const src = resolve(WORK, b.key, out.layout.image);
          const name = `r38-${pdf}-${out.layout.image.replace(/^fig_\d+_/, "")}`;
          mkdirSync(FIG_OUT, { recursive: true });
          if (existsSync(src)) copyFileSync(src, resolve(FIG_OUT, name));
          else console.warn("missing figure", src);
          out.layout.image = name;
          out.layout.labels = (out.layout.labels ?? []).filter((x: Txt) => x?.en);
        }
        if (p.type === "table") {
          // every row has the header's width; empty cells stay as {en:""}
          const w = Math.max(out.layout.columns?.length ?? 0, ...(out.layout.rows ?? []).map((r: any[]) => r.length));
          const pad = (r: any[]) => [...r, ...Array(Math.max(0, w - r.length)).fill({ en: "" })];
          out.layout.columns = pad(out.layout.columns ?? []);
          out.layout.rows = (out.layout.rows ?? []).map(pad);
        }
      } else {
        Object.assign(out, { tick_group: `g${++g}`, en: p.en ?? "", hi_reference: p.hi_reference ?? "" });
      }
      parts.push(out);
    });
  });

  // ---------- BHASHINI (Anuvaad pipeline) drafts ----------
  // translated sentence by sentence (few masks per call survive best), cached per sentence
  const all = parts.flatMap(texts);
  const sentencesOf = (en: string) => en.split(/(?<=[.;:?!])\s+(?=[A-Z(“"•])/).filter((x) => x.trim());
  const todo = [...new Set(all.filter(needsWords).flatMap((t) => sentencesOf(t.en)).filter((x) => cache[x] === undefined))];
  if (todo.length && !noDraft) {
    console.log(`${b.key}: translating ${todo.length} sentences…`);
    for (let i = 0; i < todo.length; i += 125) {
      const slice = todo.slice(i, i + 125);
      const masked = await translateBatch(slice.map((en) => ({ text: en, locked: numberTokens(en) })));
      const lostIdx = slice.map((_, k) => k).filter((k) => masked[k].lost);
      // fallback for a lost mask: the unmasked translation, if it still carries every number
      const raw = lostIdx.length ? await translateBatch(lostIdx.map((k) => ({ text: slice[k], locked: [] }))) : [];
      slice.forEach((en, k) => {
        const nums = numberTokens(en);
        let out = masked[k].text;
        if (masked[k].lost) {
          const r = raw[lostIdx.indexOf(k)]?.text ?? "";
          const repaired = out.replace(/\{\s*(\d+)\s*\}?|⟦\s*(\d+)\s*⟧?/g, (m, a1, a2) => nums[Number(a1 ?? a2)] ?? m);
          // keep whichever version carries more of the real numbers; masks that lost their braces leave bare
          // indices ("1 मिलियन टन"), so a stripped mask never wins a tie
          const kept = (x: string) => nums.filter((n) => x.includes(n)).length;
          const best = kept(r) >= kept(repaired) ? r : repaired;
          out = kept(best) === nums.length ? best : `${best} ⚠`;
        }
        cache[en] = out;
      });
      writeFileSync(cachePath, JSON.stringify(cache, null, 1));
      process.stdout.write(`  ${Math.min(i + 125, todo.length)}/${todo.length}\r`);
    }
    console.log();
  }
  let lost = 0;
  for (const t of all) {
    if (!needsWords(t)) continue;
    const ss = sentencesOf(t.en).map((x) => cache[x]);
    if (ss.some((x) => x === undefined)) continue;
    if (ss.some((x) => x!.endsWith(" ⚠"))) lost++;
    t.bhashini_draft = ss.map((x) => x!.replace(/ ⚠$/, "")).join(" ");
  }

  // ---------- glossary terms: found in the English, used by CAG's Hindi ----------
  const hiAll = all.map((t) => t.hi_reference ?? "").join(" \n ");
  const freq = new Map<string, { e: GlossaryEntry; n: number }>();
  for (const t of all) {
    if (!t.en || t.numeric) continue;
    for (const m of matchSourceTerms(t.en, index)) {
      const k = glossaryKey(m.entry.en);
      const cur = freq.get(k) ?? { e: m.entry, n: 0 };
      cur.n++;
      freq.set(k, cur);
    }
  }
  // scoring terms should be subject vocabulary, not connectives ("in the light of"), verbs ("set up"),
  // truncated primaries ("Detailed project Report = विस्तृत") or terms the D3 overrides re-word (Report → प्रतिवेदन)
  const overrides = (read(resolve(ROOT, "seed/glossary_overrides.json")) as any[]).map((o) => glossaryKey(o.english_term));
  const plausible = ({ e }: { e: GlossaryEntry }) => {
    const k = glossaryKey(e.en);
    const first = k.split(" ")[0];
    if (FUNCTION_WORDS.has(first) || /\b(to|of|for|that|is)$/.test(k)) return false;
    if (k.split(" ").some((w) => overrides.includes(w))) return false;
    if (k.split(" ").length >= 3 && e.hi.split(/\s+/).length < 2) return false;
    return e.hi.length >= 2;
  };
  const used = (f: string) => inflections(f).some((x) => containsHindi(hiAll, x));
  const seen = new Set<string>();
  const chosen = [...freq.values()]
    .filter(plausible)
    .filter(({ e }) => !GENERIC.has(glossaryKey(e.en)))
    .map(({ e, n }) => {
      // show the approved form CAG's own Hindi uses: if that is an accepted variant, it leads
      const lead = used(e.hi) ? e.hi : e.variants.find(used);
      return lead ? { e: { ...e, hi: lead, variants: [e.hi, ...e.variants].filter((v) => v !== lead) }, n } : null;
    })
    .filter((x): x is { e: GlossaryEntry; n: number } => !!x)
    .sort((x, y) => y.n * (y.e.en.includes(" ") ? 1.5 : 1) - x.n * (x.e.en.includes(" ") ? 1.5 : 1))
    .filter(({ e }) => { const k = e.hi; if (seen.has(k)) return false; seen.add(k); return true; }) // repair / Repairs → one term
    .slice(0, b.terms)
    .map(({ e }) => ({
      english_term: e.en, hindi_term: e.hi, accepted_variants: e.variants,
      // never treat a form CAG's own Hindi uses as an "avoid" form
      avoid_forms: e.avoid.filter((a) => !containsHindi(hiAll, a)),
    }));

  // ---------- planted slips: glossary slips the machine actually made ----------
  const slips: any[] = [];
  for (const p of parts) {
    const ts = texts(p);
    for (const c of chosen) {
      const enHit = ts.find((t) => t.en && new RegExp(`\\b${c.english_term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(t.en));
      if (!enHit?.bhashini_draft) continue;
      const wrong = c.avoid_forms.find((a) => a.length > 2 && containsHindi(enHit.bhashini_draft!, a));
      if (wrong && !slips.some((s) => s.part_id === p.part_id && s.wrong_text === wrong))
        slips.push({ part_id: p.part_id, kind: /[ऀ-ॿ]/.test(wrong) ? "transliteration" : "term", wrong_text: wrong, en_term: c.english_term, fix_hint: c.hindi_term });
    }
  }

  const seed = {
    page_id: `r38-${b.key}-bundle`,
    round: b.key,
    status: "draft",
    reference_status: "transcribed_from_hindi_pdf_images_needs_manager_verification",
    draft_status: noDraft ? "missing" : "anuvaad_pipeline",
    label: `Report 38/2025 · ${b.pages.length} pages`,
    source: {
      report: "Report No. 38 of 2025 (Performance Audit – Commercial), Performance of Blast Furnaces in SAIL",
      selection: b.label, english_pdf_pages: b.pages, printed_pages: printed, printed_page: printed[0],
      sector_hidden_from_player: "commercial", scope: "union",
    },
    parts,
    planted_slips: slips,
    glossary_terms: chosen,
  };
  const out = resolve(ROOT, `seed/pages/${b.key}_r38_bundle.json`);
  writeFileSync(out, JSON.stringify(seed, null, 1));
  const words = all.reduce((n, t) => n + (t.en?.split(/\s+/).filter(Boolean).length ?? 0), 0);
  console.log(`${b.key}: ${b.pages.length} pages, ${parts.length} parts, ${g} tick groups, ~${words} words, ${chosen.length} terms, ${slips.length} slips, ${lost} drafts with lost numbers → ${out}`);
}

for (const b of BUNDLES) await build(b);
