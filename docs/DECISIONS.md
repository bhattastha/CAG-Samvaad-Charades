# Decisions and deviations

Format: what · why · how to undo. Spec = CLAUDE.md v1.1.

## Stack
1. **pnpm via corepack, not a global pnpm.** The build machine had no pnpm; `corepack pnpm …` uses the version pinned in `package.json`.
2. **Raw SQL (`apps/api/src/schema.sql`) on Postgres 16, with embedded PGlite for local development — not Prisma.** *Should*-level deviation from §4. Prisma cannot run on PGlite, and the dev machine has no Docker/Postgres. The schema follows §6 table-for-table (snake_case), keeps the `(player, round, chance)` unique constraint and adds a partial unique index so a player can have only one active attempt. Production uses `DATABASE_URL=postgres://…` and the same SQL. Undo: generate a Prisma schema from `schema.sql` (`prisma db pull`) if the team prefers Prisma.
3. **Page parts store their text as `fields` (JSON) instead of one `en/hiReference/bhashiniDraft` per part row.** Tables and charts have many strings each (cells, labels, legend, source) under one tick group (§6). Every string is a field `{key, en, hiReference, draft, locked, numeric}`; plain parts have one field `t`. Scoring, editing and the console all work field-by-field.
4. **Server runs TypeScript with `tsx`** (no separate build step); the web app is built by Vite.

## Product
5. **Sahayika panels use a bright royal-blue gradient instead of `--navy #22293B`.** The client asked for a light, bright, game-like orange/white/blue theme with no dark surfaces (23 Oct). White text on the blue gradient keeps ≥ 4.5:1. Undo: `.sahayika-panel` in `apps/web/src/index.css`.
6. **Inline glossary help (client request, 23 Oct).** Glossary terms in the English source are underlined; tapping one offers the CAG Hindi and variants with "जोड़ें" into the matching Hindi part. Words worth a second look in the draft (glossary avoid-forms and planted slips) get a dotted underline; tapping offers replacements (none for slips — their fixes are never sent). To limit noise, source underlines cover page terms, multi-word glossary entries and single words ≥ 8 letters whose Hindi is not a transliteration. An avoid-form that appears in CAG's own Hindi for the page is never flagged (the automatic split in `seed/glossary.json` marks e.g. कंपनी as an avoid-form of "company").
7. **Returning players may sign in with email + OTP only** ("पहले खेल चुके हैं?" link on the registration screen) instead of refilling the form.
8. **Leaving counts include a page reload** (the page is hidden while it reloads). This matches "one count per departure" literally; revisit if officers complain.
9. **A > 40-character single insert is rejected** (treated as paste, §12), including from automation; e2e tests type character by character.
10. **Trial round has no tick groups**; completion is sentences (§1). The source panel highlights the English sentence that matches the caret position.
11. **Chat refusal line** for "translate paragraph/sentence/page for me" requests is authored in `strings.sahayikaExtra.refuseTranslate` (the script has none). These never reach the LLM.
12. **Grammar tip texts** (`strings.grammarIssues`) and all other strings added during the build are listed in `_authoredInSpec_reviewBeforeLaunch`.

## Open items (§2) — status in this build
- **D3 overrides**: seeded as `pending_confirmation`; console → Glossary → "flagged / overrides only" → "revert to glossary" toggles each.
- **D5 Anuvad scorer**: `scoring.provider = "local"`; no Anuvad adapter call is made yet (contract not supplied).
- **D6 transliteration script code**: tested live on 23 Oct — `targetLanguageScriptCode: "Latn"` (as supplied) returns Devanagari suggestions (`sarkar` → सरकार, सरकर, सारकर, सारकार). No change needed. The endpoint answered without `ANUVAAD_XLIT_AUTH`.
- **D7**: `ANUVAAD_XLIT_AUTH` sent as `Authorization` when set.
- **D8 office Hindi names**: console → Offices → batch-translate (needs `DHRUVA_NMT_KEY`), then review row by row.
- **D10 login**: email OTP via `SMTP_URL`; dev code `123456` only when `NODE_ENV` is development/test and no SMTP is set. Optional `ALLOWED_EMAIL_DOMAINS`.
- **D12 certificate**: built per §13 with a "(नमूना)" signatory placeholder.
- **Dhruva ASR binary frame event name** is not in the reference PDF; configurable `DHRUVA_ASR_DATA_EVENT` (default `data`). Confirm with BHASHINI. Until keys are set, voice typing falls back to the browser's Web Speech API (hi-IN).
- **TTS service ID** not supplied: `DHRUVA_TTS_SERVICE_ID`; until set Sahayika speaks through the browser's `speechSynthesis` (en-IN, female voice preferred).

## Seed content
- `seed/pages/primary_r38_7.json`, `secondary_r38_49.json`, `pro_r38_2.json` were built from Report 38 by reading the Hindi PDF pages visually (its text layer is broken). **Every part is `needs_verification`.** Drafts are *sample-authored* machine-style Hindi with 6–7 planted slips each (`draft_status: sample_authored_not_bhashini`) because no NMT key was available; regenerate with "Generate BHASHINI draft" once keys are set, then re-mark slips. Report 38 has no headnote boxes, footers or annexure references; see each file's `notes`. Terms "turnover", "yield" and "process" were deliberately not used because CAG's own Hindi uses forms the glossary lists as avoid-forms.
- Only one page per round exists, so the same page repeats across chances in development (`SEED_ALLOW_UNVERIFIED=1`, shown to players as "नमूना सामग्री"). Each round needs ≥ 3 verified, published pages for review (§19).

## Scoring concern for CAG to decide
Submitting BHASHINI's draft **unchanged and immediately** scores about 60 / 66 / 71 in प्राथमिक / माध्यमिक / वृत्तिक (completion 0, but time full and chrF against the reference already high). That passes 33 and earns ~31 credits without editing. See PROGRESS.md "Needs a decision".

## Iteration 2 (23 Oct, client feedback)
13. **English-first UI.** `config.ui.locale = "en"`; all player text in `content/strings.en.json` (Hindi file kept; fallback key-by-key). Sahayika lines show their `en` text. Hindi for the whole UI is to come from the **BHASHINI website-translation plugin** (`config.ui.translationPlugin.enabled/scriptUrl`; the script is injected only when enabled — its host must be added to the CSP in `deploy/nginx.conf`). The workbench (English source page and the player's Hindi) is marked `translate="no"` + `notranslate`, so a page translator can never translate the source for the player. Round names in English use `nameEn` ("Trial Round"…); titles use new `titleEn`/`titleMeaning` config fields. The certificate follows the locale.
14. **Sahayika never auto-speaks by default.** Settings → voice: Off / Only when I tap Listen (default) / Auto. Every line has Listen ⇄ Pause/Resume and Stop; a floating audio dock appears while she speaks; she stops on scene change.
15. **Game feel:** scene transitions (framer-motion), Title as start screen, profile-created reward scene, 4-step training, rules cards, **Journey map** hub, **Mission briefing** with 3-2-1-GO (server clock starts after GO), round HUD (level medal, chance pips, circular timer that changes colour + icon at 5 min / 1 min, checkpoint progress, reward pool; HUD sticky), red edge glow in the last minute, floating "+1 sentence / Part cleared!" text, particle bursts, synthesized SFX + phone haptics, "Mission complete / Time's up" stamp → scoring scene → report card (count-up score, title medal reveal, coin cascade, stars, next goal), Hall of Fame.
16. **Accessibility settings:** text/HUD size (S–XL), high contrast, reduce motion (also honours the OS setting), sound on/off + volume, vibration. Status is never shown by colour alone (icons/text accompany every state). Hover motion is disabled on touch screens so taps never miss a moving button.
17. **BHASHINI services:** service IDs in `config.bhashiniServices` (NMT `ai4bharat/indictrans-v2-all-gpu--t4`, ASR Hindi `ai4bharat/conformer-hi-gpu--t4`, TTS English female `Bhashini/IITM/TTS`). One ULCA inference key `DHRUVA_API_KEY` serves all tasks unless a per-task key is set.
