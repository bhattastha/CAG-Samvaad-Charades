# Samvaad Charades — Product and Build Specification

**CAG × Digital India BHASHINI · Hindi Pakhwada**
Version 2.0 · 25 October 2026 · Replaces v1.1 (22–23 October 2026, "Hindi Charades / हिंदी शराड्स")
Audience: Claude Code sessions and the engineering team taking this repo forward.

This file describes the product **as built today**. It is a specification, not a history: the chronological record of every change and the reason for it is `docs/DECISIONS.md` (decisions 1–58). Start with `docs/HANDOVER.md` if you are new to the repo. Section numbers match v1.1 where the topic still exists, so references such as "§11 scoring" keep working.

Legend: **Built** = exists in the repo and was exercised in development. **Not verified** = code exists but was never run in the stated environment. **Not built** = does not exist.

---

## 0. How to work from this file

1. Read this file, then `docs/HANDOVER.md`, `config/game.config.json`, and the content files in `content/`.
2. **Order of authority:** this file → `docs/DECISIONS.md` (where it records a later change) → `reference/Hindi_Charades_Concept_Note_v2_22Oct2026.docx` → screen designs in `reference/screen-designs/` (superseded for look and layout, see §7) → the older checklist (superseded). If code contradicts this file, trust the code and fix the file.
3. **"Must"** cannot be broken. **"Should"** is preferred; deviate only for a stated technical reason and record it in `docs/DECISIONS.md`.
4. **No hard-coded game values or player-facing text.** Level names, titles, times, credits, weights, thresholds, UI copy and Sahayak lines come from `config/` and `content/`. (Console labels in `apps/web/src/manager/` are hard-coded English; see §8.)
5. **Forbidden anywhere a player can see it** (UI, certificate, audio, served file names, page titles): तरकश, Tarkash, अनुवाद समर, Anuvad Samar, गुरु, Guru, ट्रायल राउंड, प्रो राउंड, अनुवाद प्रवीण, अनुवाद आचार्य, Anuvad Praveen, Anuvad Acharya, and any bow, arrow, quiver or archery image. The list is in `packages/shared/src/forbidden.ts` and is still valid. It is enforced by `corepack pnpm scan:forbidden` (built web bundle, `content/`, `config/`, `assets/brand/`, `apps/web/public/`) and by the contract test in `apps/api/test/api.test.ts` (API fixtures and a rendered certificate). `seed/glossary.json` and `reference/` are excluded on purpose (the glossary has ordinary entries such as गुरु).
6. If an item is still open (§2), build the stated default behind a config switch, log it in `docs/DECISIONS.md`, and continue.
7. Before committing run `corepack pnpm --filter @hc/shared test`, `corepack pnpm --filter @hc/api test`, `corepack pnpm typecheck` and, with the dev stack up, `corepack pnpm e2e`. (Do not use `corepack pnpm test`: `@hc/web` has no test files and Vitest exits non-zero, so the recursive run fails.) Update `docs/PROGRESS.md`.

---

## 1. The concept

**Purpose.** Officers of the Indian Audit & Accounts Department (IA&AD) sharpen official Hindi translation by working on real CAG audit-report pages, in a short, levelled game for Hindi Pakhwada. Each answer is compared with CAG's own published Hindi of the same pages.

**Value to the player.** Appraisal benefit, real translation practice, credits (up to 50) for the Hindi Pakhwada contest, a title per level, a certificate, a profile and a leaderboard.

**Value to CAG and BHASHINI.** Officers practise checking and correcting BHASHINI's machine draft against CAG's standard glossary, the skill the CAG-BHASHINI Anuvaad workflow depends on.

**Who plays.** IA&AD officers only. One officer, one player; the email ID is the unique ID.

### Levels

Fixed order; the Trial is the entry level. Names, titles, times and credits live in `config/game.config.json` → `rounds` (the config calls levels "rounds"; key names are unchanged).

| Level | Key | English name | Title at best ≥ 33/100 | Time | Content | BHASHINI draft | Voice typing | Credit cap | Completion counted by |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `trial` | Trial | Anuvad Pathik (The Translation Traveller) | 20 min | Plain passage, 300–400 words | No (from scratch) | Yes | 3 | Sentences ending in `।` |
| 2 | `primary` | Primary | Anuvad Nipun (The Skilled Translator) | 60 min | 10-page report bundle | Yes (check and improve) | No | 5 | Segments marked done |
| 3 | `secondary` | Secondary | Anuvad Vidvaan (The Translation Scholar) | 90 min | 20-page report bundle | Yes | No | 15 | Segments marked done |
| 4 | `pro` | Professional | Anuvad Visheshagya (The Translation Expert) | 120 min | 30-page report bundle (tables; charts as figures) | Yes | No | 25 | Segments marked done |
| 5 | `varchaspati` | PhD Shodharthi | Anuvad Varchaspati (The PhD-level master translator) | 600 min (placeholder) | ~300 pages | — | — | 0 | — |

- **Level 5 is Phase 2 and is not playable** (`playable: false`; the API answers `coming_soon`). It is shown on the landing page, level map and Hall of Fame with a preview briefing and a proposed assessment framework (`strings.en.json` → `varchaspati.framework`). It sits outside the 50-credit pool.
- **Credits:** registration 2 + Trial 3 + Primary 5 + Secondary 15 + Professional 25 = **50**. Boot validation refuses a config where `registration.credits + Σ creditCap ≠ maxCredits`.
- **Chances:** 3 per level. The **best** score counts; a lower later score never reduces credits.
- **Title** when best ≥ `titlePassMark` (33). Credits below the pass mark still follow the formula (`creditsBelowPassMark: true`).
- **Unlock rule** (`levels.unlockRule`, console-editable): `"all-open"` (current default, for the review build) makes Trial, Primary, Secondary and Professional playable from the start, with the Trial suggested first. `"trial-pass-unlocks-all"` is the Trial-first rule: a best Trial score ≥ `levels.trialQualifyingScore` (33) unlocks the other three, each independently playable. If all Trial chances are used below the score, the player is told to contact the game manager (no automatic reset).
- **Numbers, years and rupee amounts are never changed**; officers translate only the words. They appear as locked chips.
- **Report bundles.** Primary, Secondary and Professional each play one bundle of consecutive pages from Report No. 38 of 2025 (§17, §19). The workbench shows one printed page at a time with a page control. `rounds[].pages` (10/20/30) is config metadata and a console setting; the actual content comes from the published page rows.
- **Page choice** (`choosePage` in `packages/shared/src/rules.ts`): a published page the player has not used, spread by a stable hash of email + level + chance; else the least-used page. With one bundle per level (current state), chances 2 and 3 repeat the same bundle; the Trial has two passages.
- **Scope.** Pages carry a `scope` (`union` or a state name). Players get Union pages plus pages for their office's state; if none match, all pages.

**Prototype scope (27 Oct).** The full player journey end to end on live BHASHINI services, report cards, best-of-three credits, certificate download, and a working game-manager console. Thousands of concurrent players is out of scope.

**Devices (must).** Chrome and Edge on Windows, Safari on macOS, iPhone and iPad; mouse, touch, physical keyboard; HTTPS only. **Not verified:** only Chrome desktop and a Chrome phone-size profile were tested (§17).

---

## 2. Decisions and open items

Closed decisions are in `docs/DECISIONS.md`. Open items:

| # | Item | Current behaviour | Owner |
|---|---|---|---|
| D3 | *Annexure* (glossary says संलग्नक; concept note says **अनुलग्नक**); Appendix → परिशिष्ट; Report → प्रतिवेदन | `seed/glossary_overrides.json`, status `pending_confirmation`; console → Glossary → revert | CAG Hindi cell |
| D5 | Anuvad evaluation API contract not supplied | `scoring.provider = "local"`; **no Anuvad scoring adapter exists** | BHASHINI |
| D8 | Office Hindi names missing | English shown; console batch-translate then review | CAG |
| D10 | Login | Email + OTP; real SMTP required in production; SSO adapter not built | CAG / NIC |
| D11 | Hosting | India region only; Docker/Compose/Caddy files exist but were never built (§16) | BHASHINI DevOps |
| D12 | Certificate template, high-res logos | Built from `assets/brand/`; "specimen" signatory placeholder | Project team |
| S1 | Scoring lets an unedited draft score high (§11) | Unresolved; proposed fix in §11 and `docs/HANDOVER.md` | CAG / product |
| S2 | Timers for 20/30-page levels (90/120 min) | Unchanged from the single-page design; unreviewed | CAG |
| S3 | Repeated content across chances | One bundle per level today | CAG / content |
| S4 | Level 5 credits and format | Placeholder, 0 credits | CAG |

---

## 3. Facts about the supplied data

**Report pair** (`reference/sample-report/`, Report No. 38 of 2025, *Performance of Blast Furnaces in SAIL*, Commercial): the English PDF has a clean text layer; the Hindi PDF's text layer is **broken** (`ककया` for किया) and must never be used as a scoring reference. The Hindi edition is longer, so pages do not align. CAG's Hindi for the bundles was therefore **transcribed by reading the rendered Hindi page images**, with digits confirmed against the English (§17).

**Railway Finance pair** (`reference/sample-report/railway finance …`): Word files with clean Unicode Hindi, but the English is the 2022-23 report and the Hindi is the 2023-24 report. They are **not a parallel pair** and are unusable for scoring until the matching edition is supplied. No Railway content is built.

**Glossary** (`seed/glossary.json`, from `anuvaad-webapp-glossary_entries.xlsx`): 11,391 rows (one is sector-specific: staff → कार्मिक, Railways). "Other target terms" mix real alternatives with machine transliterations; the seed splits them into `accepted_variants` and `avoid_forms` by consonant-skeleton similarity (threshold 0.7, `config.glossary.transliterationAvoidThreshold`). Entries flagged `primary_looks_transliterated` are never offered inline unless overridden; entries flagged `empty_primary_after_cleaning` are excluded. The importer (`splitVariants` in `apps/api/src/seed.ts`) applies the same rules to uploads.

**Offices** (`seed/offices.json`): 231 offices. Office-admin names and emails in the source CSV are **not** imported.

---

## 4. Architecture and stack

| Layer | Choice (as built) |
|---|---|
| Repo | pnpm monorepo (`corepack pnpm`, pnpm 9.15 pinned in `package.json`), TypeScript strict |
| Web | React 18, Vite 6, Tailwind 3, React Router 6, TanStack Query 5, Zustand 4, Framer Motion 11; console route-split (`/manager`, lazy) |
| Translation editor | TipTap 2 (ProseMirror): atom `lockedToken` nodes, paste/drop hooks, Roman → Hindi helper, rich-text subset |
| API | Node 20+, Fastify 5, Zod 3, `@fastify/compress`, `@fastify/websocket`, `jose` (JWT), `nodemailer`, `exceljs`, `pdfjs-dist` |
| Database | PostgreSQL 16 via `pg` **or** embedded PGlite for local development; **raw SQL** in `apps/api/src/schema.sql` (no Prisma; DECISIONS 2). Selected by `DATABASE_URL` |
| Realtime | `ws` browser ↔ API; `socket.io-client` API ↔ Dhruva ASR |
| Certificate | `playwright-core` driving a system Chrome/Chromium renders HTML → PDF/PNG; without a browser the endpoint returns printable HTML |
| Tests | Vitest (shared, API); Playwright e2e (`e2e/journey.spec.ts`) |
| Run | Dev: `corepack pnpm dev` (API :8787 + Vite :5173, no Docker). Production files: `docker-compose.yml`, `deploy/` (**Not verified**, §16) |

The server runs TypeScript directly with `tsx` (no build step); Vite builds the web app.

```
hindi-charades-kit/
  CLAUDE.md                      this file (a copy sits one level up for Claude Code)
  config/game.config.json        single settings block, Zod-validated at boot
  content/                       strings.en.json, strings.onboarding.en.json, strings.workbench.en.json,
                                 strings.hi.json (fallback only), sahayika.script.json
  seed/                          offices.json, glossary.json, glossary_overrides.json,
                                 pages/*.json (2 Trial passages + 3 bundles), pages-archive/ (old single-page seeds)
  reference/                     inputs only, never served (concept note, designs, sample reports,
                                 glossary algorithm, brand/ originals, BHASHINI API PDF)
  apps/web/                      player app + /manager console
    src/screens/                 Title (landing), Register, HowToPlay (Training Ground), Rules, Journey (level map),
                                 PreRound (briefing), Round (workbench), Report, Review, Total (Hall of Fame),
                                 Profile, Leaderboard; landing/JourneyPath.tsx
    src/round/                   Workbench rows, PageViews, GlossMenu, Hud, PageControl, ChatPanel,
                                 useAttempt (autosave), useFairPlay
    src/editor/                  TranslationEditor, extensions (lockedToken), FormatToolbar, GlossaryDrawer, voice
    src/manager/                 console pages
    src/components/, src/lib/    shared UI, voice player, strings loader, store, API client
    public/landing/              logos, mascot, hero.mp4 (5 MB), poster
    public/figures/              12 cropped chart/figure images used by the Professional bundle
  apps/api/src/                  app, server, env, db, schema.sql, auth, content, game, pages, seed, ingest,
                                 routes/{player,play,services,results,admin}, admin/{analytics,players},
                                 bhashini/{client,xlit}, sahayika/engine, certificate/render,
                                 scripts/build-bundles.ts
  apps/api/test/                 api.test.ts, admin.test.ts, seed.smoke.ts
  packages/shared/src/           config, rules, scoring, glossary, text, types, seed, xlit, forbidden
  packages/shared/test/          scoring.test.ts
  scripts/                       scan-forbidden.ts, copy-fonts.mjs, content/ (segmentation + transcription work)
  e2e/journey.spec.ts            Playwright journeys
  assets/                        brand/ (certificate logos), fonts/ (Noto Sans Devanagari + Noto Sans, WOFF2)
  deploy/, docker-compose.yml    production files (unverified)
  docs/                          HANDOVER.md, DECISIONS.md, PROGRESS.md, RUNBOOK.md
```

---

## 5. Configuration

`config/game.config.json` is parsed by `packages/shared/src/config.ts` (Zod) at boot; the server refuses to start if it is invalid, if `registration.credits + Σ creditCap ≠ maxCredits`, if the first level is not `trial`, or if scoring weights do not sum to `scoreOutOf` (100).

Main blocks: `game`, `registration`, `rounds[]` (per level: `key`, `name`, `nameEn`, `title`, `titleEn`, `titleMeaning`, `levelLabel`, `timeLimitMinutes`, `creditCap`, `pages`, `bhashiniDraft`, `voiceTyping`, `completionCountedBy`, `playable`, `phase`), `maxCredits`, `maxChancesPerRound`, `titlePassMark`, `scoreOutOf`, `scoringWeights`, `timeMarks`, `creditDecimals`, `creditsBelowPassMark`, `fairPlay`, `stars`, `sahayika` (LLM service, quick questions, chat limit), `glossary`, `scoring`, `auth`, `transliteration`, `ui`, `bhashiniServices`, `brand`, `levels`.

`GET /api/config` exposes a public subset (`publicConfig`); keys, scoring constants and service IDs are not in it.

**Console-overridable settings** (`PUT /admin/config/settings`, stored in `config_overrides` key `settings`; legacy `creditCaps` key via `PUT /admin/config/credits`; both audited and re-validated against the invariants): per-level `timeLimitMinutes`, `creditCap`, `pages`; `trialQualifyingScore`; `titlePassMark`; `maxChancesPerRound`; `scoringWeights`; `unlockRule`; `scoring.chrfFloor`, `chrfCeil`, `minWordsPerSentence`; `avoidThreshold`. Everything else is file-only and needs an API restart. The effective config is the file plus these overrides (`applySettings` in `apps/api/src/content.ts`).

`bhashiniServices.translationProvider` is `"anuvaad"` (default; CAG Anuvaad pipeline) or `"dhruva"` (Dhruva NMT with `DHRUVA_NMT_KEY`). `bhashiniServices.ttsGender` is `"male"`. `ui.translationPlugin` (`enabled`, `scriptUrl`, `languages`) is the website-translation hook (§7.0), disabled.

Environment variables (names only; see `.env.example` and `docs/RUNBOOK.md`): `NODE_ENV`, `PORT`, `HOST`, `DATABASE_URL`, `JWT_SECRET`, `PUBLIC_ORIGIN`, `COOKIE_SECURE`, `SMTP_URL`, `OTP_FROM`, `ALLOWED_EMAIL_DOMAINS`, `ADMIN_EMAILS`, `DHRUVA_API_KEY` (plus optional per-task `DHRUVA_ASR_KEY`, `DHRUVA_NMT_KEY`, `DHRUVA_TTS_KEY`, `DHRUVA_LLM_KEY`), `DHRUVA_TTS_SERVICE_ID`, `DHRUVA_ASR_DATA_EVENT`, `ANUVAAD_XLIT_AUTH`, `SEED_ALLOW_UNVERIFIED`, `SEED_REFRESH_PAGES`, `CHROME_PATH`, `WEB_DIST`, `POSTGRES_PASSWORD`, `SITE_ADDRESS`.

---

## 6. Data model (`apps/api/src/schema.sql`)

Raw SQL, idempotent (`CREATE TABLE IF NOT EXISTS`, `ALTER … ADD COLUMN IF NOT EXISTS`), run on every API start (`migrate`). snake_case. Level results (best score, chances used, title, credits) are **computed from `attempts`** by `summarise()` in `packages/shared/src/rules.ts`, never stored.

| Table | Purpose / notable columns |
|---|---|
| `offices` | `id, name_en, name_hi, type, city, state, pincode, address, address_composed` |
| `players` | `id, email UNIQUE, name, mobile, office_id → offices, office_address, registered_at, registration_credits` |
| `glossary_terms` | `id, en, en_norm UNIQUE, hi, accepted_variants[], avoid_forms[], flags[], override jsonb, sector` (a sector entry's `en_norm` carries `#sector`) |
| `pages` | `id, round_key, label, printed_page_no, sector` (stored, **never sent to the client**), `source jsonb, status` (`draft`/`published`/`retired`), `active, version, sample, scope, created_at` |
| `page_parts` | `(page_id, id) PK, ord, type, tick_group, editable, layout jsonb, fields jsonb, en_sentences jsonb, reference_verified, page_no` |
| `planted_slips` | `page_id, part_id, kind` (`term`/`transliteration`/`grammar`/`omission`)`, wrong_text, en_term, fix_hint` |
| `page_terms` | `(page_id, en) PK, ord, hi, variants[], avoid[]` (the scored glossary terms of a page) |
| `attempts` | `id, player_id, round_key, chance_no, page_id, started_at, deadline_at, last_saved_at, submitted_at, auto_submitted, status` (`active`/`submitted`)`, answers jsonb, answers_version, active_client_id, left_page_count, paste_blocked_count, measures, score, tip, result, chat_count, session_id`; `UNIQUE (player_id, round_key, chance_no)`; a partial unique index allows one active attempt per player |
| `attempt_events` | `attempt_id, type, at, meta` (leaves, blocked pastes, submit, etc.) |
| `sahayika_lines` | console edits of script lines: `id, section, part, moment, spoken, en, hi, edited_by, edited_at` (overlay on the script file) |
| `chat_logs` | every Sahayak Q/A: `player_id, attempt_id, question, en, hi, source` (`rule`/`faq`/`llm`/`guard`)`, blocked` |
| `xlit_stats` | `(day, accepted_index) → count`; no typed text stored |
| `otp_challenges` | `email PK, code_hash, expires_at, tries, sent_count, window_start` |
| `admin_users` | `email, role` (`manager`/`viewer`) |
| `config_overrides` | `key, value jsonb, by, at` |
| `audit_logs` | `actor, action, target, at, meta` |

**Fields, not one string per part.** A part's text is a list of fields `{key, en, hiReference, draft, locked[], numeric}` (DECISIONS 3). Plain parts have one field `t`; tables and figures have many (cells, labels, legend, source) under one tick group. Scoring, editing and the console work field by field. `hiReference` is never sent to the client.

**Part types** (`packages/shared/src/types.ts`): `passage, header, heading, headnote, body, footnote, footer, page_number, table, chart, figure, annexure_ref`. `figure` is a chart, diagram or photo kept as an image (`/figures/…`) with editable title, word labels and source.

**Tick groups.** Each header, heading, headnote, footer, footnote and body paragraph is one group; a whole table is one group; a whole figure is one group; page numbers and number-only fields are neither editable nor counted. The Trial has no tick groups (sentences instead).

**Answers.** `answers[partId] = { fields: {key: text}, done: boolean, html?: {key: html} }`. Plain text is the only thing scored. `html` is an optional sanitised rich-text copy (whitelist; dropped if a locked number had to be re-inserted).

---

## 7. Screens (player)

The v1.1 designs in `reference/screen-designs/` are **superseded** for look and flow (DECISIONS 29, 31, 39–53). Current routes (`apps/web/src/main.tsx`):

| Route | Screen | Access |
|---|---|---|
| `/` | Landing (`Title.tsx`) | public |
| `/register` | Registration and sign-in (`?returning=1`) | public |
| `/how-to-play` | Training Ground | player |
| `/rules` | Rules briefing | player |
| `/journey` | Level map | player |
| `/play/:key` | Mission briefing | player |
| `/round/:id` | Workbench | player |
| `/report/:id` | Report card | player |
| `/review/:id` | Review own answer | player |
| `/total` | Hall of Fame (total score) | player |
| `/profile` | Profile | player |
| `/leaderboard` | Leaderboard | player |
| `/manager/*` | Console (§8) | admin |

A "player" route redirects to `/register` unless `GET /me/progress` says `registered: true`.

### 7.0 Language, brand, look
- **The UI is monolingual English** (`config.ui.locale = "en"`). All text is in `content/`; `lib/strings.ts` deep-merges `strings.en.json` ← `strings.onboarding.en.json` ← `strings.workbench.en.json`, and the API merges `strings.en.json` over `strings.hi.json` key by key. `strings.hi.json` (the original Hindi UI) is **retained only as a fallback**; it is not shown. Hindi for the whole UI is meant to come from the BHASHINI website-translation plugin: set `ui.translationPlugin.enabled/scriptUrl` and add the plugin's host to the CSP in `apps/api/src/app.ts` and `deploy/nginx.conf`. The workbench (English source and the player's Hindi) is marked `translate="no"` and `notranslate`, so a page translator can never translate the source for the player. **Not verified** with a real plugin.
- **Brand.** "Samvaad Charades" (`config.brand`; localised spellings listed there need native review). The brand is never translated (rendered with `translate="no"`). The guide is **Sahayak** (सहायक). The old names "Hindi Charades / हिंदी शराड्स / Sahayika" must not appear to players; code identifiers and the file `content/sahayika.script.json` keep the old spelling.
- **Look.** Professional game-portal style in the CAG Anuvaad palette: navy `#0B2342`, orange `#F15A24`, gold `#D6A642`, light background `#F3F6FB`, secondary blue `#24558A`; 8/12 px radii; inline SVG icon set (`components/Icon.tsx`); rank-insignia medals; Noto Sans Devanagari / Noto Sans self-hosted (`@fontsource` for the app, `assets/fonts` WOFF2 for the certificate). Status is never shown by colour alone. Orange buttons need ≥ 18 px bold labels; small orange text should use the stronger orange.
- **One header** on every screen: white logo plate with the official CAG and BHASHINI logos, brand name and "CAG · BHASHINI", portal nav (Levels, Leaderboard, Score and certificate), credits chip, profile menu (My profile, Levels, Leaderboard, Score & certificate, Settings, Sign out). Round screens use a full-width header.
- **Settings panel** (`components/Settings.tsx`): Sahayak voice (Off / Only when I tap Listen / Auto), text/HUD size (S–XL), high contrast, reduce motion (also honours the OS), sound and volume, vibration. Preferences are stored in the browser.
- **Brand assets.** Official logos and the approved Sahayak mascot render (originals in `reference/brand/`, README there). Never redraw or approximate them.

### 7.1 Landing — `/`
Cinematic page: white logo plate, sound switch ("Sahayak voice guide", `role="switch"`), settings, "Sign in" for returning players; hero "Samvaad Charades", "Translate. Learn. Play.", "A Translation Challenge for CAG Officers."; **Start Playing** (or **Continue Playing** → `routeFor`: resume the active attempt, else the Training Ground for a player who has not played, else the level map). Background is the CAG-building video `public/landing/hero.mp4` (muted loop, 5 MB), replaced by `hero-poster.jpg` under reduced motion or data-saver. Waist-up Sahayak render with the CAG seal on the pocket and a speech panel playing `landing.screen.welcome`. A five-stage journey on a golden S-curve (vertical trail on phones): glass cards for the five levels with real state (completed / in progress / available / locked / "Coming soon" for Level 5) from `GET /me/progress`, or from the unlock rule for visitors. No word/page counts, time limits or credit breakdowns on the landing page. `GET /stats/public` (aggregate players, offices, credits, titles, bundles) exists.

### 7.2 Registration and sign-in — `/register`
Player-card form: name, mobile (10 digits starting 6–9, `+91` fixed), email, office (searchable combobox over offices, English or Hindi), office address (pre-filled from the office, editable). Live player card, an animated "Your Rewards Journey" panel (+2 now, up to 50), compact Sahayak guide (`before_game.screen.registration_open`), privacy note. Flow: **Create my player card** → OTP emailed → 6-digit field → **Verify & enter** → player created with 2 credits → success popup (`registration_done`) → **Start training**. A returning player uses "Sign in" (email + OTP only) and is resumed. Optional `ALLOWED_EMAIL_DOMAINS` restricts sign-up.

### 7.3 Training Ground — `/how-to-play`
Four steps with a contextual right panel: (1) Your Mission, (2) How You Score, (3) Your Translation Toolkit with three tabs — **Roman to Hindi** (live practice instance of the editor, nothing saved), **Glossary – Shabd Udyan** (live search on `/api/glossary`), **Speak to type** (Trial only), (4) **Meet Your Guide – Sahayak** (Coach dialogue from `how_to_play_new` / `how_to_play_returning`). Copy in `strings.onboarding.en.json`.

### 7.4 Rules — `/rules`
Gamified rules briefing: level cards from config, rule cards (no copy-paste, three chances per level, typing only), Sahayak lines `rules_open` and `rules_credits`, and an **agreement control** that must be accepted before **Continue** (to the level map).

### 7.5 Level map and mission briefing — `/journey`, `/play/:key`
The map shows the five levels with status, best score, chances, title, credits, stars and the next suggested level. The briefing shows level, title, chance n / 3, time, rules and Sahayak lines (`first_chance` or `retry`, `typing_only_notice` before Primary, rotating `tip.n`) from `GET /rounds/:key/intro`. **Trial only: microphone check** with a level meter before the clock starts (denial → voice off, keyboard works); no permission prompt ever appears after the clock starts. **Start** (a user gesture) requests fullscreen where supported, runs a 3-2-1-GO countdown, and only then calls `POST /rounds/{key}/attempts` (the server clock starts there).

### 7.6 Workbench — `/round/:id` (all four levels)
Document-style layout (DECISIONS 52–54):
- **Workbench bar** (sticky): back, level, chance n / 3, "In progress", timer chip (`mm:ss` under 1 h, `h:mm:ss` above; the circular timer changes colour and icon at 5 min and 1 min; red edge glow in the last minute; announced to screen readers at 5 and 1 minutes), progress ("n / N segments done" or sentences), credits at stake, save status, **Ask Sahayak**, **Full Screen** (hidden where unsupported), **Submit Translation**. The level label gets a "review build" tag if the page row has `sample = true`.
- **Home ribbon** (one tab): paragraph style (Default/H1/H2/H3), Bold/Italic/Underline, lists, alignment, undo/redo, and **Speak** (Trial only). Formatting is stored beside the plain text and never scored.
- **ORIGINAL DOCUMENT / TRANSLATED DOCUMENT** pane titles with Collapse/Expand; grey canvas with two white "papers".
- **Trial:** two panels — the English passage and one editor. Each finished sentence (ends in `।`, ≥ 2 words) gets a ✓; the English sentence matching the caret is highlighted; "n / N sentences".
- **Primary / Secondary / Professional:** one row per segment, English left and the BHASHINI draft (editable) right, always in the same row; tables keep their grid (number cells read-only, word cells editable, one tick for the table); figures show the image read-only with editable title, labels and source; numbers in running text are locked chips. Each segment is finished with a round **Mark as done** control (green rail and tint, +1 float, one-time dismissible hint). A per-segment QA strip (empty fields, numbers kept, English words left, flagged words, full stop) shows issue counts. A 10/20/30-page bundle shows one printed page at a time.
- **Inline glossary** (DECISIONS 50; algorithm in `reference/glossary-matching-algorithm.md`): matched terms are underlined in the English and, paired, in the Hindi (approved forms and accepted variants; avoid-forms in orange); hovering highlights the pair; clicking opens a **menu directly under the word** with the approved Hindi first, variants, other-sector forms with a sector label, struck-out avoid-forms, and "Search the full glossary" (opens the glossary drawer). Choosing replaces the Hindi word, or inserts at the cursor when clicked from the English side. There is no side panel. Planted-slip words and avoid-forms in the draft get a dotted underline; slip fixes are never sent.
- **Bottom status bar:** page control "‹ Page n of N ›" with a jump grid, word and character count of the focused page, zoom 80–140 % (CSS `zoom`, remembered).
- **Sahayak in-round lines** (§10.2) appear as a slim card above the status bar and auto-hide after 8 s. The **chat panel** opens from Ask Sahayak.
- **Phone:** the Trial gets a segmented "Original | Translated" toggle; segment rows stack; tables scroll inside their own container.
- **Warnings:** leaving the page shows a warning card on return; opening the attempt in a second window makes the older one read-only ("This round is open in another window.").

### 7.7 Report card — `/report/:id`
Count-up score out of 100, title medal reveal (or a "title needed" note below 33), credits earned and total / 50, stars (1 for registration + 1 per title earned), three chance chips (best marked), the five measures as counts (translation `n / 10`, time `m / limit min`, completion `n / N sentences|segments`, glossary `n / N terms`, sentence construction `n / 10`), one tip line, "left the page" count if > 0, Sahayak announcement lines per §10.3, session ID, and the next suggested level or Hall of Fame. **Review your answer** links to `/review/:id`; **Play again · n chances left** when any remain.

### 7.8 Review — `/review/:id`
Read-only view of the player's own submitted text with flagged terms, slips, Latin words and grammar issues underlined. Never shows the CAG reference or fixes.

### 7.9 Hall of Fame (total score) — `/total`
Congratulations, total credits / 50 (count-up), stars, per-level title, best score, chances used and credits, Sahayak lines (`end.screen.*`), **certificate download** (`/api/me/certificate?format=pdf`), **Improve your score** (a picker of levels with chances left), replay note.

### 7.10 Profile and leaderboard
`/profile`: player card (mobile masked), rank, level records, 10 achievements (computed), attempt history (`GET /me/profile`). `/leaderboard`: All-India / my state / my office, podium, own row pinned, gap to the next rank (`GET /leaderboard?scope=&limit=`). Names show as first name + last initial, offices as "city, state"; ranking is credits, then sum of best scores, then stars. Every signed-in player can see these (open decision, `docs/HANDOVER.md`).

---

## 8. Game manager console — `/manager`

Staff-facing, desktop-first, **English only with hard-coded labels** (not in `content/`), CAG Anuvaad visual language. Login at `/manager` uses the same email + OTP flow; the email must be in `ADMIN_EMAILS` or in the `admin_users` table. Roles: `manager` (edit, publish, reset) and `viewer` (read, export). Left navigation:

| Section | What it does |
|---|---|
| **Overview** | KPIs and charts for 7 days / 30 days / all time (`GET /admin/analytics/overview`): registrations and activity per day, engagement funnel, levels at a glance, score distribution, measure breakdown, credits distribution, attempt outcomes, fair-play signals and watch list, participation by state, top offices, most-missed glossary terms, avoid-forms players used, content usage per bundle, Sahayak chat, BHASHINI service health (circuit breakers), live activity feed (15 s) |
| **Players** | List and detail; **guarded reset** (confirm by retyping the email) deletes attempts, events and chat, optionally the player |
| **Results & export** | Per-player best, chances, titles, credits; **Export credits (xlsx)** (email, name, mobile, office, per-level best/chances/credits, titles, total) |
| **Content library** | Reports and their bundles (status, verified parts, times used, average score, scope Union/State); bundle editor (references, verification per part, draft generation, slips, terms, publish/retire); **Add a report** (upload PDF → auto-segment a page from the text layer → create a draft page) |
| **Glossary** | Search, edit, overrides (reason, status, revert), CSV import, flagged queue |
| **Offices** | Edit Hindi name and address, CSV import, batch-translate names (needs a translation service) |
| **Sahayak** | Script lines by section with edit (saves to `sahayika_lines`; also deletes that line's pre-generated audio), **Regenerate audio**, chat log with blocked answers first |
| **Evaluation & settings** | Levels (time, credits, pages), progression (unlock rule, Trial qualifying score, pass mark, chances), scoring weights (must total 100), evaluation constants (chrF floor/ceil, minimum words per sentence, avoid threshold), change history, read-only effective config, **Danger zone** (delete all players and play data; typed phrase `RESET ALL TEST DATA`) |
| **Audit log** | Every admin action (searchable) |

**Publish rule** (`POST /admin/pages/:id/publish`): refused with 409 `unverified_parts` until every editable part is marked `reference_verified`, and with `missing_draft` if a non-Trial page has an editable field without a draft.

**Ingest status.** Built: PDF page segmentation (`POST /admin/ingest/segment`, text layer, heuristics only), manual reference entry, per-part verification, locked-token detection in the seed converter, draft generation, slip marking, term selection. **Not built:** the OCR route (`POST /admin/pages/:id/ocr`) always returns 501 even though the Docker image installs tesseract; automatic Hindi-page pairing by anchors. The Report 38 bundles were produced by the offline pipeline in §17, not by the console. **Known gap:** nothing in the API or console clears `pages.sample`, so a published seed page still carries the "review build" tag (`docs/HANDOVER.md`).

---

## 9. BHASHINI integration

**All calls go through the API; no key or token reaches the browser.** The Dhruva auth header is the raw token (`Authorization: <token>`, not `Bearer`). One ULCA inference key, `DHRUVA_API_KEY`, serves ASR, TTS and LLM (and NMT when `translationProvider` is `dhruva`); per-task keys override it. Service IDs are in `config.bhashiniServices` (and `config.sahayika.llmServiceId`). All calls use `apps/api/src/bhashini/client.ts`.

| Use | When | Endpoint / service |
|---|---|---|
| Draft translation en→hi | Content build and console only, **never during play** | **Anuvaad pipeline** `https://anuvaad-backend.bhashini.co.in/v1/pipeline` (default, no key; optional `ANUVAAD_XLIT_AUTH`), service `ai4bharat/indictrans-v2-all-gpu--t4`; alternative Dhruva pipeline `https://dhruva-api.bhashini.gov.in/services/inference/pipeline` |
| Transliteration en→hi | Live, translation editor only | `config.transliteration.endpoint` (Anuvaad pipeline URL), service `ai4bharat/indicxlit--cpu-fsv2`, via `GET /api/xlit?word=` |
| ASR hi, streaming | Trial voice typing | Socket.IO `wss://dhruva-api.bhashini.gov.in`, path `/socket.io`; service `ai4bharat/conformer-hi-gpu--t4` |
| ASR hi, file | Fallback | Dhruva pipeline, `taskType: "asr"` (`POST /speech/asr`) |
| TTS en | Sahayak voice | Dhruva pipeline, `taskType: "tts"`, service `bhashini/bodhan/indic-tts` (override `DHRUVA_TTS_SERVICE_ID`), `gender: male` |
| LLM | Sahayak chat | `https://dhruva-api.bhashini.gov.in/services/inference/llm`, `bhashini/google/gemma-4-26B-A4B-it`, temperature 0 |

**Draft generation.** `translateBatch`: 25 fields per call, 5 calls in parallel. Locked tokens are masked as **`{0}`, `{1}`…** (not `⟦n⟧`: live tests showed that form comes back as bare digits and numbers get reordered; `{n}` returns intact). Drafts are translated sentence by sentence; when a mask is still lost, the version keeping more real numbers wins and the field is flagged. About 60 of ~580 bundle parts still miss a number (a genuine MT omission the player must fix; the QA strip names the missing figure).

**Transliteration helper (Roman → Hindi), translation editor only** (the practice editor included; not in registration, glossary search, Sahayak chat or the console). Proxy `GET /api/xlit?word=` (signed-in player): word must match `^[A-Za-z]{1,30}$`; 7-day LRU cache of 50,000 words; 20 requests/s per player; 2.5 s timeout; response `{suggestions, fallback?}`; keeps only suggestions containing Devanagari, de-duplicated, capped at `numSuggestions` (4); on failure returns `fallback` from the local ITRANS-style map (`romanToDevanagari` in `packages/shared/src/xlit.ts`). `targetLanguageScriptCode` is `"Latn"` as supplied; it returned Devanagari in live tests on 23 Oct, so no change was needed.

Editor behaviour (`apps/web/src/editor/TranslationEditor.tsx`), default mode "Roman to Hindi":

| Player action | Result |
|---|---|
| Types Latin letters | Current Roman word underlined; after 150 ms a popup at the caret shows up to 4 Hindi suggestions numbered 1–4, then the Roman word as option 5; suggestion 1 highlighted |
| Space or Enter | Commit the highlighted suggestion plus the space/newline |
| 1–4, click or tap | Commit that suggestion |
| ↑ / ↓ | Move the highlight |
| Esc or option 5 | Keep the Roman word (counts as a Latin word in scoring) |
| Backspace right after a commit | Restore the Roman word |
| `.` after a word | Commit and insert `।`; a second `.` gives a literal `.`; a `.` between digits is untouched |
| Digits, punctuation | Inserted as typed, never transliterated |
| Typing before results arrive | Stale requests aborted; only the latest word's results show |

Autocorrect, autocapitalise and spellcheck are off on the editor. Typing Devanagari directly (device keyboard) always works; "device keyboard" mode only switches suggestions off (used in the practice box). **InScript was removed entirely** (DECISIONS 49); unused `INSCRIPT*` constants remain in `packages/shared/src/xlit.ts`. Telemetry counts the accepted suggestion index per day (`xlit_stats`); typed words are never stored. A phone suggestion strip above the on-screen keyboard is **not verified** on real devices.

**Voice typing (Trial only).** Browser AudioWorklet (`public/pcm-worklet.js`) → 16 kHz mono PCM16 → `WS /api/speech/asr/stream` → the API relays to Dhruva (`start`, binary frames on the event named by `DHRUVA_ASR_DATA_EVENT`, default `data`, **unconfirmed with BHASHINI**). Intermediate text shows grey at the caret; final text commits; spoken "पूर्ण विराम" → `।` without doubling. Fallback: the browser Web Speech API (`hi-IN`); if neither works the player sees a message and keeps typing. The API refuses ASR unless the active attempt's level has `voiceTyping`. **Not verified with a real microphone and key.**

**Resilience.** 8 s timeout (transliteration 2.5 s), 3 tries with backoff on 5xx (timeouts are not retried), circuit breaker per task (5 consecutive failures open it for 30 s); health is shown in the console. On failure the player sees a friendly message and keeps typing; work is never lost.

---

## 10. Sahayak (सहायक)

**Character.** A friendly male guide (young man in a graduation-style outfit; no archery). Professional coach voice; simple English, at most 3 short sentences. Every line has an `en` text (shown and spoken) and a `hi` text (kept for a Hindi build; written gender-neutral, DECISIONS 31). A circular head crop is used wherever the avatar is small; the waist-up render appears in guide cards and on the landing page.

**The script is the single source of truth** (DECISIONS 56): `content/sahayika.script.json` has 195 lines with stable IDs `section.part.moment[.n]` (sections `landing` 1, `before_game` 6, `trial` 42, `primary` 48, `secondary` 46, `pro` 47, `end` 5), plus `knowledge`, `faq`, `samplePageFacts`, `chatbotRules` and the placeholder list. The landing bubble (`landing.screen.welcome`), registration guide (`registration_open`), success popup (`registration_done`), Training Coach (`how_to_play_new/returning`), Rules (`rules_open`, `rules_credits`), briefing, in-round, report-card, end-screen and chat lines all read it through `GET /api/sahayika/lines` (client cache refreshes after 5 s and on window focus). Console edits are stored in `sahayika_lines` as an overlay and win over the file. `spoken: false` lines are shown only. Placeholders are filled server-side: `{name}`, `{score}`, `{best_score}`, `{chance}`, `{chances_left}`, `{marks_short}`, `{credits}`, `{total_credits}`, `{leaves}`, `{parts_left}`, `{time_left}`, `{page_no}`, `{en_term}`, `{hi_term}`, `{wrong_word}`, `{grammar_tip}`.

### 10.1 Voice
Playback is under the player's control: voice mode Off / tap-to-listen (default) / Auto (landing switch and Settings). Every line has Listen ⇄ Pause/Resume and Stop; a floating audio dock appears while it speaks; speech stops on scene change. Sources, in order: a pre-generated file `GET /api/sahayika/audio/:lineId` (WAV under `.data/audio/`, made by console "Regenerate audio" for lines without placeholders) → live `POST /api/sahayika/tts` (cache keyed by text, 500 entries) → browser `speechSynthesis` (`en-IN`, **male** voice preferred). Saving a line in the console deletes its audio file; the endpoint is `no-cache`. No pre-generated audio exists today (`.data/audio` is empty); voice is live TTS or the browser voice until a manager regenerates.

### 10.2 In-round triggers
`pre_round.first_chance/retry/typing_only_notice/tip.n` (briefing), `in_round.round_start` (+`round_start_followup`, `{page_no}`), `under_source` (Trial, 90 s idle), `mic_tapped`, `half_time`, `half_parts_done`, `all_done_before_submit`, `copy_paste_blocked`, `five_min_left`, `one_min_left`, `submit_with_parts_left` (first Submit press with segments open; a second press within 4 s submits), `left_popup_title` + `left_tab` / `left_fullscreen` + `left_count_note`, `time_up`.

### 10.3 Report-card line selection (`reportCardLines` in `rules.ts`)
1. Best ≥ 33: chance 1 → `title_earned_first_chance`; later chance first reaching 33 → `first_pass_on_retry`; later new best → `new_best`; else `not_new_best`; then `title_name`, `credits_line`.
2. Best < 33: chances left and best 28–32 → `so_close` (`{marks_short}`); chances left → `below_pass_chances_left`; none → `below_pass_no_chances`; `title_needed_note` replaces the title.
3. Tip line, `typing_only_next` after the Trial, `left_count_note` if the player left, and `pro.report_card.all_rounds_played` the first time every playable level has been played.

End screen: `end.screen.total_open`, then `all_titles_won` or `titles_missing` (a missing title's level has chances left) or the plain line; `replay_note` when any level has chances left.

### 10.4 Chat (`POST /api/sahayika/chat`, `apps/api/src/sahayika/engine.ts`)
- Quick questions come from `config.sahayika.quickQuestions` (hint, score, glossary, time; `credits` is also accepted). Outside a round → `trial.chat.opened_outside_round` or a matching FAQ.
- **Rule-based first:** "translate this paragraph/sentence/page" → refusal line (`strings.sahayikaExtra.refuseTranslate`; never reaches the LLM); hint / score / time / credits / glossary keywords → ready lines with placeholders; a question naming a glossary term → `ask_term`; matching FAQ → the FAQ answer.
- **Hint engine** (no LLM): (1) a planted slip or avoid form still present → `hint_wrong_word`; (2) a page term whose Hindi is missing → `hint_missing_term`; (3) an open grammar issue from the scorer → `hint_grammar`; else `hint_all_good`. Never reveals the fix beyond the glossary term.
- **LLM only for other questions.** System prompt: `chatbotRules`, `knowledge.before_game`, the current level's `knowledge` and `faq`, the page's glossary terms, live facts (time left, chance, credits). JSON `{"en","hi"}` required. The model is never given the page's English body, CAG Hindi, draft text or sector. **Output guard:** reject (→ `unknown_question`) if the answer contains any 5-word run from the page's English, reference or draft, a report number or sector name, or a planted slip's fix; `en` is trimmed to 3 sentences. 20 questions per attempt. Every Q/A is logged to `chat_logs`.
- Known text bug: `systemPrompt` still tells the model "you are female, use feminine verbs" while the guide is male and the Hindi lines are gender-neutral (`docs/HANDOVER.md`).

---

## 11. Scoring (deterministic local scorer, `packages/shared/src/scoring.ts`)

Each measure is in [0, 1]. **Score = round(translation×30 + completion×20 + sentence×20 + glossary×20 + time×10)**; weights from config (console-editable, sum 100). An empty answer after normalisation scores 0.

Normalise: NFC; strip ZWJ/ZWNJ; `|` → `।`; collapse whitespace.

| Measure | Method | Report card |
|---|---|---|
| Translation | Per editable part: chrF (char n-grams 1–6, β = 2) of player vs `hiReference`, calibrated `clamp((chrF − floor)/(ceil − floor))` with floor 0.20, ceil 0.85; length-weighted average. Trial = whole passage | `round(×10) / 10` |
| Completion | Trial: sentences ending `।?!` with ≥ 2 words, capped at the source count. Main levels: tick groups where every part is marked done **and** non-empty, ÷ groups | `18 / 20 sentences`, `5 / 6 segments` |
| Sentence construction | 1 − 0.05 per Latin-script word not in the reference or locked − 0.05 per missing sentence-final `।` (sentence-type parts) − 0.03 per word starting with a vowel sign − 0.02 per immediately repeated word − 0.05 per unbalanced bracket − 0.02 per source number missing (Trial); floor 0 | `round(×10) / 10` |
| Glossary | Per page term: correct if the primary or an accepted variant is present (simple inflections: `ा`→`े/ों/ाओं`, `ी`→`ियों/ियाँ/ियां`, else `+ों/ें`) **and** no avoid form of that term **and** not the English word in Latin; overrides (D3) apply. Value = correct / terms (1 if none) | `9 / 12 terms` |
| Time | `f = used / limit`; 1 if f ≤ 0.5, else linear down to 0.6 at f = 1 (`timeMarks`) | `16 min / 20 min` |

Tip = first issue in page order: term → grammar → praise. Credits per level = `round(best × cap × 10 / 100) / 10`; worked examples 84×3 → 2.5, 88×5 → 4.4, 88×15 → 13.2, 92×25 → 23; total 2 + 2.5 + 4.4 + 13.2 + 23 = **45.1**. The total is capped at `maxCredits`. `scoring.provider` accepts `"anuvad"` in the schema but **no Anuvad scoring adapter is implemented**; the local scorer always runs.

**Known loophole (S1, unresolved).** In the main levels the answer is pre-filled with BHASHINI's draft. Submitting it unchanged and immediately scores high in translation (chrF against CAG's Hindi), glossary and time; completion is 0 only because nothing is marked done. Measured in iteration 1 on single-page seeds at roughly 60 / 66 / 71 in Primary / Secondary / Professional; not re-measured on the bundles. Proposed fix (not built): score translation as improvement over the draft, `(chrF(answer) − chrF(draft)) / (1 − chrF(draft))` floored at 0, and give time marks only for edited or marked-done segments, behind a config switch.

Unit tests in `packages/shared/test/scoring.test.ts`: reference vs itself → translation 1 and glossary 12/12 on the seed Trial passage; empty → 0; "विपणन" → "मार्केटिंग" → glossary 11/12; time fractions 0.4/0.75/1.0 → 1.0/0.8/0.6; the credit examples; unlock rules (both).

---

## 12. Game rules engine and fair play (server-authoritative)

**Start** `POST /rounds/{key}/attempts` (`startAttempt` in `apps/api/src/game.ts`): resume any active attempt (409 `other_round_active` if it belongs to another level); the level must be unlocked and playable (`canStart`); chances < max else 409 `no_chances` (the unique constraint is the backstop); choose a page (§1); `startedAt` = server now, `deadlineAt` = + limit; the chance is used from this moment; answers pre-filled (Trial empty; main levels = BHASHINI drafts, `done: false`). In production only `status = 'published'` pages are eligible; in development with `SEED_ALLOW_UNVERIFIED=1` sample pages are too.

**Autosave** `PUT /attempts/{id}/autosave {version, clientId, answers}` (POST from `sendBeacon`): 2 s after typing stops, every `autosaveIntervalSeconds` (10) and on `pagehide`; mirrored in IndexedDB. Rejects stale versions, other windows, and anything after deadline + 30 s grace; re-inserts removed locked tokens; sanitises rich text.

**One live window:** the latest `clientId` to open the attempt takes over; the older tab turns read-only.

**Submit / auto-submit:** the client submits at zero; a server job every 30 s submits any active attempt past deadline + grace from its last autosave (`auto_submitted`, time fraction 1). Early submit with segments open: the first press shows how many are left, a second press within 4 s submits. The submit request carries the final answers.

**Freeze screen** (`useFairPlay`, `TranslationEditor`, from start to submit):
- Fullscreen where supported (desktop, iPad). iPhone Safari has none: focus layout plus visibility tracking.
- Blocked: `paste`, `copy`, `cut`, `drop`, `dragstart`, `contextmenu`, `beforeinput` of `insertFromPaste/Drop/Yank`, Ctrl/Cmd + C/V/X. Toast, `copy_paste_blocked` line, server count. A single input event inserting > 40 characters that is not from the helper, glossary or ASR is reverted as a paste (this also rejects automation, so e2e tests type character by character).
- Leaving: tab hidden, desktop window blur, fullscreen exit → one count per departure (2 s debounce, the server debounces too), warning card on return, count on the report card. A page reload counts (the page is hidden while it reloads). The workbench's own Full Screen toggle exiting is not counted (3 s window).
- Locked numbers: TipTap atom node `lockedToken`; a transaction filter rejects deleting or changing it.

---

## 13. Certificate

`GET /api/me/certificate?format=pdf|png|html` (`apps/api/src/certificate/render.ts`), A4 landscape, Noto Sans Devanagari / Noto Sans embedded: CAG and BHASHINI logos, brand name, "This is to certify that", player name and office, titles earned (only levels with best ≥ 33, in level order, English titles), total credits / 50, date, verification ID (12-hex SHA-256 over email, total, date and `JWT_SECRET`), "Authorised signatory (specimen)" placeholder. Text is in `strings.certificate` and follows the locale. It still uses the original orange/blue styling and the line "CAG × BHASHINI · HINDI PAKHWADA". It needs Chrome/Chromium (`CHROME_PATH` or a standard path); otherwise printable HTML is returned. There is no endpoint to verify the ID.

---

## 14. API surface (all under `/api`)

Session: httpOnly cookie `hc_session` (JWT HS256, 12 h, `SameSite=Lax`, `Secure` when `COOKIE_SECURE`). Zod validates bodies. Rate limits: OTP 5/hour/email, chat 20/attempt, xlit 20/s/player. Responses are gzip/brotli compressed. Errors are `{error: code}`.

| Group | Endpoints |
|---|---|
| Auth | `POST /auth/otp/request`, `POST /auth/otp/verify`, `POST /players/register`, `POST /auth/logout`, `GET /offices?q=` |
| Content | `GET /config`, `GET /rounds`, `GET /content/strings`, `GET /sahayika/lines?section=`, `GET /glossary?q=`, `GET /stats/public` |
| Player | `GET /me/progress` (no 401 for visitors), `GET /me/summary`, `GET /me/profile`, `GET /leaderboard?scope=all\|state\|office&limit=`, `GET /rounds/:key/intro`, `GET /me/certificate?format=` |
| Play | `POST /rounds/:key/attempts`, `GET /attempts/:id`, `PUT\|POST /attempts/:id/autosave`, `POST /attempts/:id/events`, `POST /attempts/:id/submit`, `GET /attempts/:id/report`, `GET /attempts/:id/review`, `GET /attempts/:id/clock` |
| Language services | `GET /xlit?word=`, `WS /speech/asr/stream`, `POST /speech/asr`, `GET /sahayika/audio/:lineId`, `POST /sahayika/tts`, `POST /sahayika/chat` |
| Health | `GET /health` |
| Admin (manager = write, viewer = read) | `GET /admin/me`, `/admin/dashboard`, `/admin/analytics/overview?range=`, `/admin/activity`, `/admin/library`, `/admin/pages`, `/admin/pages/:id`; `POST /admin/pages`, `PUT /admin/pages/:id`, `PUT /admin/pages/:id/meta`, `PUT /admin/pages/:id/parts/:partId/verify`, `PUT /admin/pages/:id/slips`, `POST /admin/pages/:id/draft`, `/publish`, `/retire`, `/ocr` (501), `POST /admin/ingest/segment`, `PUT /admin/reports/scope`; `GET /admin/glossary`, `PUT /admin/glossary/:id`, `POST /admin/glossary/import`; `GET /admin/offices`, `PUT /admin/offices/:id`, `POST /admin/offices/import`, `/admin/offices/translate-names`; `GET /admin/sahayika/lines`, `PUT /admin/sahayika/lines/:id`, `POST /admin/sahayika/audio`, `GET /admin/chatlog`; `GET /admin/results`, `/admin/exports/credits`; `GET /admin/config`, `PUT /admin/config/credits`, `PUT /admin/config/settings`, `GET /admin/config/history`, `GET /admin/audit`; `GET /admin/players`, `/admin/players/:id`, `POST /admin/players/:id/reset`, `POST /admin/danger/reset-play-data` |

The client must never receive `hiReference`, `sector`, planted-slip fixes, other players' data (the leaderboard returns first name + initial only) or any key. `GET /attempts/:id` returns the page through `playerPage()`/`clientPage()`, which strip them; the contract test in `apps/api/test/api.test.ts` checks it. `GET /attempts/:id/report` and `/review` never include the reference.

Response security headers (`apps/api/src/app.ts`): CSP `default-src 'self'` with `img-src 'self' data: blob:`, `media-src 'self' blob: data:`, `style-src 'self' 'unsafe-inline'`, `font-src 'self' data:`, `connect-src 'self' ws: wss:`, `frame-ancestors 'none'`; `Permissions-Policy: microphone=(self), camera=()`; `X-Content-Type-Options`; `Referrer-Policy`; HSTS when `COOKIE_SECURE`. `deploy/nginx.conf` repeats the CSP with `connect-src 'self' wss:`.

---

## 15. Experience features built

Autosave status in the workbench bar; one live window; review of the player's own answer with underlines; mic check before the clock; Roman → Hindi helper with undo and `.` → `।`; linked highlighting between the English and Hindi segment; inline glossary menus; rich-text subset; page control, zoom and word count; Mark as done with feedback; sound effects and phone haptics (`lib/sfx.ts`); accessibility settings; timer announcements to screen readers; compressed payloads (the 30-page level is about 130 KB on the wire, DECISIONS 36). Not verified: the phone suggestion strip on real devices.

---

## 16. Security and privacy

- Keys only in server environment variables; `.env.example` lists names, never values; `.env` is git-ignored. **Rotate any key that has ever been shared** (the development `.env` holds one that was shared in chat; create a fresh `.env`).
- Personal data (name, mobile, email, office) only in the database; privacy note at registration; exports limited to managers and viewers; every admin write audited. Office-admin contacts are not imported. The profile masks the mobile.
- **Production rules enforced in `apps/api/src/env.ts`:** `JWT_SECRET` is required; `SEED_ALLOW_UNVERIFIED` must not be set. `COOKIE_SECURE` defaults on. The fixed OTP `123456` works only when `NODE_ENV` is `development`/`test` **and** `SMTP_URL` is empty; in production it is rejected (`otp_invalid`), and `POST /auth/otp/request` fails with `server_error` until `SMTP_URL` and `OTP_FROM` are set, so a real mail sender is required (checked 25 Oct by booting the API with `NODE_ENV=production`; it boots with only `JWT_SECRET`, `DATABASE_URL`, `ADMIN_EMAILS`).
- HTTPS with HSTS and India-region hosting are deployment requirements. `docker-compose.yml`, `deploy/Caddyfile`, `deploy/nginx.conf`, `deploy/api.Dockerfile` and `deploy/web.Dockerfile` exist but **Docker is not installed on the build machine and none of it was ever built or run**.
- The PGlite-to-PostgreSQL path (`DATABASE_URL=postgres://…`) is written (`apps/api/src/db.ts`) but was **not run against a real PostgreSQL** in this build.
- A scan of git history and tracked files found no secrets (25 Oct); only `.env.example` is tracked.
- The console is English-only; the CSP has no allowance for a translation-plugin host until one is added.

---

## 17. Test strategy, commands and content pipeline

**Commands** (repo root, `corepack pnpm`):

| Command | What it runs |
|---|---|
| `corepack pnpm --filter @hc/shared test` | Scoring and unlock rules |
| `corepack pnpm --filter @hc/api test` | Player journey, contract, admin (in-memory PGlite) |
| `corepack pnpm typecheck` | `tsc --noEmit` in every package |
| `corepack pnpm build` then `corepack pnpm scan:forbidden` | Web bundle build, then the forbidden-words scan |
| `corepack pnpm dev` (one terminal) then `corepack pnpm e2e` | Playwright `chrome` and `phone-chrome` projects against :5173 |

`corepack pnpm test` (recursive) **fails** because `@hc/web` has no test files; use the `--filter` forms.

API tests (`apps/api/test/api.test.ts`, `admin.test.ts`) cover: registration with 2 credits, bad OTP, Trial and unlock rules, page payload without reference/sector/slip fixes, stale-version and second-window autosave rejection, chat refusal, hints and term answers, leave debounce, report card, the 4th chance refused, locked tokens re-inserted, certificate titles, returning-player resume, the client-leak contract, admin routes closed to players, rich-text sanitising, analytics, player reset and delete, reset-all phrase, library grouping, settings validation, Sahayak edit reaching players and stale audio removal. E2E (`e2e/journey.spec.ts`, 3 tests) covers the new-player path through the Trial to a Primary workbench, settings toggles and manager console access; it expects `unlockRule` `all-open`. **Playwright WebKit crashes on the build Mac (bus error)**; the `webkit` and `iphone` projects are defined but unrun. Real iPhone, iPad, Safari and Edge checks were never done.

**Content pipeline (how the Report 38 bundles were made).** Working files are in `scripts/content/` (`BRIEF.md` is the transcription brief):
1. `segment_en.py` (PyMuPDF) segments each English PDF page into typed parts (header, heading, body, headnote, footnote, table, figure, page number) from the text layer and crops charts/photos as figures. `dump_text.py` dumps exact English text and the Hindi text layer (digits only); `crop.py` re-crops figures.
2. CAG's Hindi for each part was **transcribed by reading the rendered Hindi PDF page images** into `scripts/content/work/<bundle>/page_<pdf>.json`; digits were confirmed against the English. The Hindi edition is longer, so pages do not align; where an English sentence crosses a page break the Hindi is split at the nearest clause (or repeated) and flagged with a `note`.
3. `apps/api/src/scripts/build-bundles.ts` (`corepack pnpm --filter @hc/api exec tsx src/scripts/build-bundles.ts [--no-draft]`) assembles the bundles: drafts from the Anuvaad pipeline with number masks (cached in `scripts/content/work/drafts.json`), glossary terms found with the Anuvaad matching algorithm and kept only when CAG's Hindi uses them (excluding connectives, verbs, generic words and D3-overridden words); it writes `seed/pages/{primary,secondary,pro}_r38_bundle.json` and copies figure crops to `apps/web/public/figures/`. Selection (no page repeats across levels): Primary = Executive Summary vi–x, Ch II 7–8, Ch VI 57–59; Secondary = Ch IV 34–41, Ch V 43–52, Ch VI 53–54; Professional = Ch I 1–6, Ch III 9–19, Ch IV 21–33. About 3.7k / 8.5k / 12.1k English words.
4. The Trial passages (`trial_r38_page_v.json`: Executive Summary p. v; `trial_r38_conclusion.json`: Chapter IV "Summing up", 327 words) were OCR'd and cleaned and use the seed-passage format.
5. **Verification status:** every part of every seed page is `needs_manager_verification` / `needs_verification`. A human at CAG must verify references and mark slips in the console before any page is published. Bundle slips and drafts may need regenerating after verification.

`scripts/content/work/img/`, `fig_*.png` and `en_*.json` are git-ignored build artefacts.

---

## 18. Ready-for-review checklist

1. Shared and API tests, `typecheck`, and `build` + `scan:forbidden` pass; e2e passes on a running dev stack.
2. No old name, no forbidden term, no archery imagery anywhere (CI scan).
3. A new player registers (+2); a returning player resumes with credits intact.
4. Levels, names, titles, times and caps match §1 and config.
5. Trial: voice + keyboard, no draft. Other levels: draft, keyboard only, numbers locked.
6. Transliteration suggestions appear only in the translation editor; Space picks the first; Esc keeps Roman.
7. Copy/cut/paste/right-click blocked; leaving warned and counted; the timer survives refresh; time-out auto-submits.
8. Report card: five measures as counts, score / 100, chances with best marked, one tip, title only at ≥ 33.
9. The 4th attempt is refused; credits from best score to 1 decimal; total never above 50.
10. Sahayak: every line has English text with Listen; chat follows §10.4; script edits in the console reach players.
11. The certificate lists only titles earned.
12. No `hiReference`, `sector`, slip fixes or keys in any client response.
13. **Production-only, not yet done:** verified and published content, real SMTP, a PostgreSQL run, a Docker build, HTTPS, a Safari/iPhone/WebKit pass (`docs/HANDOVER.md`).

---

## 19. Seed and reference files

| File | Contents | Status |
|---|---|---|
| `seed/offices.json` | 231 offices | Ready; Hindi names pending (D8) |
| `seed/glossary.json` | 11,391 rows with accepted variants, avoid forms, flags, one sector entry | Ready |
| `seed/glossary_overrides.json` | Annexure, Appendix, Report | Pending CAG confirmation (D3) |
| `seed/pages/trial_r38_page_v.json`, `trial_r38_conclusion.json` | Trial passages | Need manager verification |
| `seed/pages/primary_r38_bundle.json` (110 parts), `secondary_r38_bundle.json` (185), `pro_r38_bundle.json` (284) | 10/20/30-page bundles from Report 38 | All parts `needs_verification` |
| `seed/pages-archive/` | Old single-page seeds | Archived, not loaded |
| `content/*.json` | UI copy, onboarding and workbench copy, Sahayak script | Ready; the English copy was written during the build and is for CAG to review |
| `reference/` | Concept note, designs (superseded), sample reports, glossary algorithm note, brand originals, BHASHINI API PDF | Inputs only; never served |

On every API start `seedAll` is idempotent: it loads offices, glossary, overrides and any seed page that does not yet exist, as `status = draft`, `sample = true`. `SEED_REFRESH_PAGES=1` re-imports seed pages over rows with `sample = true` (development only; because `sample` is never cleared, it would reset a published seed page to draft). Players are served sample pages only when `SEED_ALLOW_UNVERIFIED=1` outside production.
