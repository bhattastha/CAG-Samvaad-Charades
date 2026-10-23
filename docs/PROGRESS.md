# Progress — 23 Oct 2026

| Milestone | Status | Evidence |
|---|---|---|
| M0 monorepo, config/strings/script loaders, seed, forbidden-words CI | ✅ (Compose written, not run: no Docker on build machine) | `pnpm seed`, `pnpm scan:forbidden` |
| M1 shared rules + scoring with §11 tests | ✅ | `packages/shared/test` — 14 tests incl. 12/12, 11/12, time 1.0/0.8/0.6, credits 2.5/4.4/13.2/23 → 45.1 |
| M2 OTP auth, registration, how-to-play, rules, returning resume | ✅ | API tests + Chrome e2e |
| M3 attempts, timer, autosave (2 s / 10 s / beacon / IndexedDB), auto-submit job, one live window, freeze screen, TipTap with locked chips, InScript, glossary drawer | ✅ | API tests (stale version, other window, 4th chance 409, locked tokens re-inserted); e2e refresh keeps text |
| M4 transliteration helper + proxy, ASR relay + fallback, batch NMT, TTS | ✅ code / ⚠ keys | Live xlit verified; NMT/ASR/TTS/LLM need Dhruva keys |
| M5 report card, review, total, credits, stars, tips, certificate | ✅ | Certificate PDF/PNG rendered via Chrome with correct conjuncts |
| M6 Sahayika: lines wired to triggers, audio fallback, hint engine, chat + guards | ✅ | "Translate paragraph 2 for me" refused (API test) |
| M7 console: dashboard, pages, ingest (PDF text-layer segmentation), reference/draft/slips/terms editors, publish gate, glossary + overrides, offices, Sahayika lines/audio/chat log, results + xlsx, audited credit caps | ✅ / ⚠ OCR | OCR runs only in the Docker image (tesseract hin) — returns 501 locally |
| M8 cross-device + accessibility | 🟡 | Chrome desktop + phone-size (touch) e2e pass. Playwright WebKit crashes on this Mac (bus error) — run `--project=webkit --project=iphone` in CI on Linux; manual check on real iPhone/iPad/Safari still needed |

## Test commands
- `corepack pnpm --filter @hc/shared test` · `corepack pnpm --filter @hc/api test`
- e2e (needs `pnpm dev` running): `corepack pnpm exec playwright test --project=chrome --project=phone-chrome`

## Needs a decision
1. **Unedited-draft scores** (see DECISIONS.md): suggested fix — score अनुवाद for main rounds as *improvement over the draft* (`(chrF(answer) − chrF(draft)) / (1 − chrF(draft))`, floored at 0), and give time marks only to parts actually edited/ticked. Behind a config switch.
2. Real BHASHINI keys (NMT, ASR, TTS + service ID, LLM) for the 27 Oct demo.
3. Manager verification of the four seed pages, plus 2 more pages per round.
