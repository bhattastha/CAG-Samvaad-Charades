import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { seedToPage, type SeedPage } from "@hc/shared";
import { migrate, openDb, type Db } from "./db.js";
import { env, ROOT } from "./env.js";
import { loadGlossary, savePage } from "./pages.js";

const readJson = (p: string) => JSON.parse(readFileSync(resolve(ROOT, p), "utf8"));
const enNorm = (s: string) => s.toLowerCase().replace(/’/g, "'").replace(/\s+/g, " ").trim();

// ---------------- CSV ----------------

export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  const t = text.replace(/^﻿/, "");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"' && t[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((x) => x.trim()));
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

// ---------------- glossary variant split (§3: consonant skeleton, threshold 0.7) ----------------

const DEV_CONS: Record<string, string> = {
  क: "k", ख: "k", ग: "g", घ: "g", ङ: "n", च: "c", छ: "c", ज: "j", झ: "j", ञ: "n", ट: "t", ठ: "t", ड: "d", ढ: "d", ण: "n",
  त: "t", थ: "t", द: "d", ध: "d", न: "n", प: "p", फ: "f", ब: "b", भ: "b", म: "m", य: "y", र: "r", ल: "l", व: "v", श: "s", ष: "s", स: "s", ह: "h",
  "क़": "k", "ख़": "k", "ग़": "g", "ज़": "j", "ड़": "d", "ढ़": "d", "फ़": "f",
};
const skeletonHi = (s: string) => [...s.normalize("NFD").replace(/़/g, "")].map((c) => DEV_CONS[c] ?? "").join("");
const skeletonEn = (s: string) => s.toLowerCase().replace(/ph/g, "f").replace(/ch/g, "c").replace(/sh/g, "s").replace(/th/g, "t").replace(/w/g, "v").replace(/x/g, "ks").replace(/q/g, "k").replace(/z/g, "j")
  .replace(/c(?=[eiy])/g, "s").replace(/c/g, "k").replace(/[^bcdfghjklmnpqrstvwxyz]/g, "").replace(/(.)\1+/g, "$1");
function similarity(a: string, b: string) {
  if (!a || !b) return 0;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return 1 - d[a.length][b.length] / Math.max(a.length, b.length);
}
export function splitVariants(en: string, others: string[], threshold = 0.7) {
  const accepted: string[] = [], avoid: string[] = [];
  const e = skeletonEn(en);
  for (const o of others.map((x) => x.trim()).filter(Boolean)) {
    if (/[A-Za-z]/.test(o) || similarity(skeletonHi(o), e) >= threshold) avoid.push(o);
    else accepted.push(o);
  }
  return { accepted, avoid };
}

export async function importGlossaryCsv(db: Db, csv: string) {
  let n = 0;
  for (const r of parseCsv(csv)) {
    const en = r.english_term, hi = r.hindi_term;
    if (!en || !hi) continue;
    const { accepted, avoid } = splitVariants(en, (r.accepted_variants ?? "").split(/[;|,]/));
    await db.query(
      `INSERT INTO glossary_terms (id, en, en_norm, hi, accepted_variants, avoid_forms, flags) VALUES ($1,$2,$3,$4,$5,$6,'{}')
       ON CONFLICT (en_norm) DO UPDATE SET hi=$4, accepted_variants=$5, avoid_forms=$6`,
      [`g-${enNorm(en)}`, en, enNorm(en), hi, accepted, avoid],
    );
    n++;
  }
  return n;
}

const composeAddress = (city: string, state: string, pin: string) => `${city}, ${state}${pin ? ` – ${pin}` : ""}`;

export async function importOfficesCsv(db: Db, csv: string) {
  let n = 0;
  for (const r of parseCsv(csv)) {
    if (!r._id || r.is_deleted === "true") continue;
    // office-admin names and emails in this CSV are deliberately NOT imported (§3, §16)
    const composed = !r.office_address;
    await db.query(
      `INSERT INTO offices (id, name_en, type, city, state, pincode, address, address_composed) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (id) DO UPDATE SET name_en=$2, type=$3, city=$4, state=$5, pincode=$6`,
      [r._id, r.office_name, r.office_type || "Field Office (FO)", r.city, r.state, r.office_pincode || null, r.office_address || composeAddress(r.city, r.state, r.office_pincode), composed],
    );
    n++;
  }
  return n;
}

// ---------------- full seed ----------------

export async function seedAll(db: Db, log = console.log) {
  await migrate(db);

  const offices = readJson("seed/offices.json") as any[];
  for (const o of offices) {
    await db.query(
      `INSERT INTO offices (id, name_en, name_hi, type, city, state, pincode, address, address_composed) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (id) DO UPDATE SET name_en=$2, type=$4, city=$5, state=$6, pincode=$7`,
      [o.office_id, o.office_name_en, o.office_name_hi, o.office_type, o.city, o.state, o.pincode, o.office_address, o.address_is_composed],
    );
  }
  log(`offices: ${offices.length}`);

  const gl = readJson("seed/glossary.json") as any[];
  const have = await db.one<{ n: number }>("SELECT count(*)::int AS n FROM glossary_terms");
  if ((have?.n ?? 0) < gl.length) {
    // bulk insert in chunks via unnest (fast on both PGlite and Postgres)
    for (let i = 0; i < gl.length; i += 500) {
      const chunk = gl.slice(i, i + 500);
      await db.query(
        `INSERT INTO glossary_terms (id, en, en_norm, hi, accepted_variants, avoid_forms, flags)
         SELECT 'g-' || n, e, n, h, string_to_array(av, '\u001f'), string_to_array(ao, '\u001f'), string_to_array(f, '\u001f')
         FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[]) AS t(e, n, h, av, ao, f)
         ON CONFLICT (en_norm) DO NOTHING`,
        [
          chunk.map((g) => g.english_term), chunk.map((g) => enNorm(g.english_term)), chunk.map((g) => g.hindi_term),
          chunk.map((g) => g.accepted_variants.join("\u001f")), chunk.map((g) => g.avoid_forms.join("\u001f")), chunk.map((g) => g.flags.join("\u001f")),
        ],
      );
    }
    // string_to_array('') gives {} — good; clean any {""} left from empty strings
    await db.query("UPDATE glossary_terms SET accepted_variants='{}' WHERE accepted_variants = '{\"\"}'");
    await db.query("UPDATE glossary_terms SET avoid_forms='{}' WHERE avoid_forms = '{\"\"}'");
    await db.query("UPDATE glossary_terms SET flags='{}' WHERE flags = '{\"\"}'");
  }
  log(`glossary: ${gl.length}`);

  // D3 overrides: seeded as pending_confirmation; one click in the console reverts (active=false)
  for (const o of readJson("seed/glossary_overrides.json") as any[]) {
    const ov = { hi: o.hindi_term, variants: o.accepted_variants, avoid: o.avoid_forms, reason: o.reason, status: o.status, active: true };
    await db.query(
      `INSERT INTO glossary_terms (id, en, en_norm, hi, override) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (en_norm) DO UPDATE SET override = COALESCE(glossary_terms.override, $5)`,
      [`g-${enNorm(o.english_term)}`, o.english_term, enNorm(o.english_term), o.hindi_term, JSON.stringify(ov)],
    );
  }
  await loadGlossary(db);

  const dir = resolve(ROOT, "seed/pages");
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    const raw = JSON.parse(readFileSync(resolve(dir, f), "utf8")) as SeedPage & { reference_status?: string; source?: any };
    const { page, sector } = seedToPage(raw);
    const exists = await db.one("SELECT 1 FROM pages WHERE id=$1", [page.id]);
    if (exists) continue;
    // unverified seed pages are playable only as labelled sample content in development (§19)
    await savePage(db, page, { sector, source: raw.source, status: "draft", sample: true });
    log(`page: ${page.id} (${page.roundKey}, ${page.parts.length} parts, ${page.terms.length} terms, ${page.slips.length} slips)`);
  }

  for (const email of env.ADMIN_EMAILS)
    await db.query("INSERT INTO admin_users (email, role) VALUES ($1,'manager') ON CONFLICT (email) DO NOTHING", [email]);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const db = await openDb();
  await seedAll(db);
  await db.close();
  console.log("seed complete");
}
