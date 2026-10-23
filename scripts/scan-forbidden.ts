/**
 * CI gate (CLAUDE.md §0.5): fail if any forbidden name/title or archery imagery reaches a player.
 * Scans the built web bundle, content/, config/ and served asset names. The API response fixtures and a
 * rendered certificate are scanned in apps/api/test/api.test.ts. seed/glossary.json and reference/ are
 * source data and are excluded on purpose (the glossary has ordinary entries such as गुरु).
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { findForbidden } from "../packages/shared/src/forbidden.ts";

const root = resolve(import.meta.dirname, "..");
const targets = ["apps/web/dist", "content", "config", "assets/brand", "apps/web/public"];
const textExt = /\.(js|mjs|css|html|json|svg|txt|md)$/;
let hits = 0, files = 0;

function walk(p: string) {
  if (!existsSync(p)) return;
  if (statSync(p).isDirectory()) { for (const f of readdirSync(p)) walk(join(p, f)); return; }
  files++;
  const rel = relative(root, p);
  const nameHits = findForbidden(rel);
  const bodyHits = textExt.test(p) ? findForbidden(readFileSync(p, "utf8")) : [];
  for (const h of new Set([...nameHits, ...bodyHits])) { console.error(`✗ ${rel}: "${h}"`); hits++; }
}

for (const t of targets) walk(join(root, t));
if (!existsSync(join(root, "apps/web/dist"))) console.warn("! apps/web/dist not built; run `pnpm --filter @hc/web build` first for a full scan");
if (hits) { console.error(`forbidden-words scan FAILED: ${hits} hit(s) in ${files} files`); process.exit(1); }
console.log(`forbidden-words scan passed: ${files} files clean`);
