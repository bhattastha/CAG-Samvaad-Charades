# Handover — Samvaad Charades

Read this first. It says what the product is, what works, what does not, how to run it, what must happen before go-live, and where to change things. The full specification is `CLAUDE.md` (v2.0, 25 Oct 2026); the chronological log of decisions is `docs/DECISIONS.md`.

## 1. What this is, what is done, what is not

**Samvaad Charades** is a CAG × BHASHINI game in which IA&AD officers translate real CAG audit-report pages from English to Hindi and are scored against CAG's own published Hindi. Four playable levels (Trial, Primary, Secondary, Professional) give 3 + 5 + 15 + 25 credits, plus 2 for registering, 50 in total; each level has 3 chances, the best score counts, and a score of 33 or more earns a title. Level 5 (PhD Shodharthi) is a Phase 2 placeholder and cannot be played. The UI is English; the guide is **Sahayak** (male voice).

**Done (built and exercised in development, Chrome only):**
- Full player journey: landing, email-OTP sign-up and sign-in, Training Ground, rules, level map, briefing with mic check and countdown, workbench, report card, review of own answer, Hall of Fame, certificate, profile, leaderboard.
- Workbench: Original/Translated document layout, inline Anuvaad-algorithm glossary menus, Roman to Hindi helper, rich-text subset, locked number chips, Mark as done, QA strip, status bar with page control and zoom, autosave with one-live-window, fair play (paste blocking, leave counting, fullscreen), auto-submit.
- Server-authoritative game rules, deterministic local scorer, best-of-three credits, stars, report-card lines.
- Sahayak: 195-line script (single source, editable in the console), hint engine, guarded chat, three-tier voice (pre-made audio, live TTS, browser voice).
- Game manager console: KPI overview, players with guarded reset, results and xlsx export, content library with bundle editor and publish gate, glossary, offices, Sahayak, settings overrides, audit log, danger zone.
- Content: 60 pages of Report 38 of 2025 in three bundles (Primary 10, Secondary 20, Professional 30) and two Trial passages, with CAG Hindi references, Anuvaad drafts, glossary terms, figures.
- Tests: shared scoring and rules, API journey, contract and admin tests, a 3-test Playwright e2e.

**Not done / not verified (details in sections 4 and 5):**
- **No content is production-ready.** Every seed page is unverified; production serves only published pages, so a production deployment today has no playable content until a manager verifies and publishes.
- The PostgreSQL path, Docker, Compose, Caddy and nginx files have never been run. Docker is not installed on the build machine.
- Safari, iPhone, iPad, Edge and WebKit were never tested. Voice typing was never tested with a real microphone and key.
- Scoring lets an unedited draft score high (known loophole).
- No Anuvad scoring adapter, no OCR in the console, no SSO, no certificate verification page, no Railway Finance content, Level 5 not built.

## 2. Quick start

**Prerequisites:** Node 20 or newer (built on Node 24), Corepack (ships with Node; `corepack pnpm` uses pnpm 9.15 pinned in `package.json`). No Docker or Postgres needed locally: the API uses embedded PGlite when `DATABASE_URL` is empty. For the certificate, a Chrome or Chromium install (`CHROME_PATH` if not in a standard location). Python with PyMuPDF is needed only to redo the content pipeline.

```bash
cd hindi-charades-kit
corepack pnpm install
cp .env.example .env        # create your OWN .env; never reuse the old one (see section 4)
corepack pnpm dev           # API http://127.0.0.1:8787 + web http://localhost:5173
```

- **Player login (development):** open http://localhost:5173, Start Playing, register. The OTP is `123456` (fixed code only when `NODE_ENV` is `development`/`test` and `SMTP_URL` is empty; the API also returns it in the response and logs it).
- **Sample content in development:** set `SEED_ALLOW_UNVERIFIED=1` in `.env`, otherwise no page is playable (seed pages are drafts).
- **Manager login:** put your email in `ADMIN_EMAILS` (comma-separated) in `.env`, restart the API, open http://localhost:5173/manager, request an OTP for that email (`123456` in development). Managers can edit; `admin_users` rows with role `viewer` are read-only.
- **Live BHASHINI services:** put the ULCA inference key in `.env` as `DHRUVA_API_KEY` and restart the API. Without it: drafts and transliteration still work (Anuvaad endpoint, no key needed), but TTS falls back to the browser voice, Sahayak chat falls back to rule-based answers and "unknown" lines, and server voice typing falls back to the browser's Web Speech API.
- **Reset test data:** console → Evaluation & settings → Danger zone (type `RESET ALL TEST DATA`; deletes all players and play data, keeps content), or console → Players → reset one player, or stop the servers and delete `.data/` (a fresh database, then reseed on next start).
- **Refresh seed content after rebuilding bundles:** set `SEED_REFRESH_PAGES=1` (development only), restart the API, then unset it. It overwrites seed pages that still have `sample = true`, including ones you published (see known issue 11).
- **Tests:** `corepack pnpm --filter @hc/shared test`, `corepack pnpm --filter @hc/api test`, `corepack pnpm typecheck`, `corepack pnpm build && corepack pnpm scan:forbidden`; with `corepack pnpm dev` running, `corepack pnpm e2e`. Do not run `corepack pnpm test` at the root: the web package has no tests and the recursive run fails.
- Restart the API after any `.env` change. Restart Vite after editing `apps/web/vite.config.ts`. Config in `config/game.config.json` is read at boot.

More commands and troubleshooting: `docs/RUNBOOK.md`.

## 3. Go-live checklist

Tick every item. Section 3.1 lists what the production build enforces; 3.2 lists what is still missing.

### 3.1 Environment and production behaviour (`apps/api/src/env.ts`, `auth.ts`)

| Variable | Production requirement |
|---|---|
| `NODE_ENV` | `production`. Turns off the fixed OTP, makes `COOKIE_SECURE` default on, forbids `SEED_ALLOW_UNVERIFIED` |
| `JWT_SECRET` | **Required**, 32+ random characters. The API refuses to start without it. Also used in OTP hashes and the certificate verification ID; changing it signs everyone out |
| `DATABASE_URL` | `postgres://user:pass@host:5432/dbname`. Empty means PGlite files under `.data/`, which is not for production |
| `SMTP_URL`, `OTP_FROM` | **Required.** Without `SMTP_URL`, `POST /auth/otp/request` returns `server_error` in production and nobody can sign in. The fixed code `123456` is rejected in production |
| `ADMIN_EMAILS` | Comma-separated manager emails (seeded into `admin_users` at start) |
| `COOKIE_SECURE` | `1` (default in production); needs HTTPS or browsers drop the cookie |
| `PUBLIC_ORIGIN` | The public HTTPS origin |
| `ALLOWED_EMAIL_DOMAINS` | Recommended: restrict sign-up (for example the CAG domains) |
| `DHRUVA_API_KEY` | The ULCA inference key for ASR, TTS and LLM. Server-side only. `DHRUVA_TTS_SERVICE_ID` only to override the service in config |
| `SEED_ALLOW_UNVERIFIED` | Must be unset or `0`; the server throws if it is `1` in production |
| `SEED_REFRESH_PAGES` | Must be unset in production |
| `POSTGRES_PASSWORD`, `SITE_ADDRESS` | Compose only |

Verified on 25 Oct by booting the API with `NODE_ENV=production` on a temporary PGlite database: it boots with only `JWT_SECRET`, `DATABASE_URL` and `ADMIN_EMAILS`; `123456` is rejected (`otp_invalid`); OTP request fails until SMTP is configured.

### 3.2 Checklist

1. **Create a fresh `.env`** from `.env.example`. The development `.env` on the build machine holds a BHASHINI key that was shared in chat. **Rotate that key** (and any key that has ever been shared) and never commit `.env` (it is git-ignored; a scan of git history and tracked files on 25 Oct found no secrets and only `.env.example` tracked).
2. **Content must be verified and published in the console before production.** All 60 transcribed Report 38 pages (three bundles) and both Trial passages are `needs_verification`. In production players can only be given pages with `status = 'published'` (`apps/api/src/game.ts`, `startAttempt`: `status='published' OR (SEED_ALLOW_UNVERIFIED AND sample)`). All seeded pages are `draft` with `sample = true`, so **production has no playable content** until a CAG manager (a) verifies every part's Hindi reference in the bundle editor, (b) checks drafts (regenerate if needed), slips and glossary terms, and (c) publishes. Publish is blocked until every editable part is verified. Each level needs at least one published page; the design intent is at least three per level so chances differ (not met today). Note the landing page's `GET /stats/public` "bundles" counter counts sample pages too and is misleading in production.
3. **Real PostgreSQL.** Set `DATABASE_URL`, start the API once, check the tables and seeded rows. The `pg` code path in `apps/api/src/db.ts` and the raw SQL in `schema.sql` have **not been run against a real PostgreSQL** in this build (only PGlite). Treat as untested; run the full API test suite and a manual journey against it.
4. **Real email sender** (SMTP) and a test of the OTP email template (`strings.email`).
5. **Docker, Compose, Caddy, nginx: not verified.** `docker-compose.yml`, `deploy/api.Dockerfile`, `deploy/web.Dockerfile`, `deploy/nginx.conf`, `deploy/Caddyfile` were written but **never built or run** (Docker is not installed on the build machine). Expect fixes. Known points to check: the API image installs tesseract/poppler but nothing uses them (the OCR route is a stub); `WEB_DIST=/nonexistent` is set so nginx serves the web build; nginx `connect-src` omits `ws:`; `deploy/Caddyfile` takes `SITE_ADDRESS`.
6. **CSP check.** The CSP is set in `apps/api/src/app.ts` and repeated in `deploy/nginx.conf`. After deploying, load every screen with the browser console open and confirm nothing is blocked (hero video, fonts, figures, websockets for voice, blob audio). If you enable the website-translation plugin, add its host.
7. **HTTPS and HSTS** on the public host (Caddy or your reverse proxy). Cookies are `Secure` in production.
8. **India-region hosting** (NIC MeghRaj or BHASHINI infrastructure): database, API and backups.
9. **Console → Sahayak → Regenerate audio** (needs `DHRUVA_API_KEY`; the TTS service is `bhashini/bodhan/indic-tts`, male). `.data/audio` is empty today, so voice currently comes from live TTS or the browser. Mount `.data` as a persistent volume.
10. **CAG Hindi cell** confirms the D3 glossary overrides (Annexure/Appendix/Report) in console → Glossary.
11. **Office Hindi names:** console → Offices → batch-translate and review (optional; the English name is shown otherwise).
12. **Review copy:** `content/strings.en.json` and the Sahayak script were written during the build and need CAG review; the certificate text and the signatory placeholder ("specimen") need CAG's template.
13. **Browsers:** a full pass on Chrome and Edge (Windows), Safari (macOS), iPhone and iPad Safari. Run Playwright `webkit` and `iphone` projects on Linux CI (they crash on the build Mac).
14. **Compress the hero video** (`apps/web/public/landing/hero.mp4`, 5 MB).
15. Run `corepack pnpm build && corepack pnpm scan:forbidden` and all tests in CI.
16. Clear all test data (Danger zone) before opening to real players.

## 4. Secrets and keys

- Keys live only in server environment variables. Nothing in `apps/web` reads a key; the browser calls `/api/...` only. Dhruva calls send the raw token as `Authorization: <token>` (no `Bearer`).
- `.env` is git-ignored; `.env.example` lists names only.
- **Rotate any key that has ever been shared** in chat, email or a ticket. The `.env` on the build machine holds such a key. Each deploying team member creates their own `.env`.

## 5. Known issues and open decisions

**Open decisions (product):**
1. **Scoring improvement-over-draft.** Submitting BHASHINI's unchanged draft immediately scores high in the main levels (translation, glossary and time marks; completion is 0 only because nothing is marked done). Measured at about 60 / 66 / 71 for Primary / Secondary / Professional in iteration 1 on the old single-page seeds; not re-measured on the bundles. Suggested fix: translation as improvement over the draft, floored at 0, and time marks only for edited or marked-done segments, behind a config switch (`CLAUDE.md` §11). This is the main fairness issue to settle before real credits are awarded.
2. **Timers for 20/30-page levels.** Secondary 90 min and Professional 120 min were set for single pages and kept for 20 and 30 pages (about 8.5k and 12.1k English words); they are console-editable. Nobody has timed a real translator against them.
3. **"No repeated content".** Each of Primary, Secondary, Professional has one bundle, so chances 2 and 3 repeat it; the Trial has two passages for three chances. More bundles (and a matching Hindi edition) are needed for the "different page each chance" rule.
4. **Leaderboard privacy.** Every signed-in player sees everyone's first name, last initial, office city and state, credits and stars (`GET /leaderboard`, `GET /stats/public` is aggregate only). CAG should confirm this is acceptable or add an opt-out.
5. **PhD Shodharthi (Level 5) credits and format** are placeholders (0 credits, 300 pages, 600 minutes).
6. **Railway Finance parallel edition missing.** The supplied English is the 2022-23 report and the Hindi the 2023-24 report; no content can be built from them.
7. **Unlock rule.** `all-open` is the current default for the review; switch to `trial-pass-unlocks-all` in the console when the Trial-first rule is wanted.

**Known issues (engineering):**
8. About 60 of ~580 bundle drafts are missing a number (MT omission); players must fix it, the QA strip names it.
9. **Glossary underline noise.** Inline underlines cover page terms plus glossary entries that are multi-word or at least 4 letters, excluding stop words and entries whose approved Hindi is itself a transliteration (`loadGlossary` in `apps/api/src/pages.ts`). Some pages still look busy; tune the `strong` rule there.
10. **Speak-to-type** (Trial) was never tested with a real microphone and key; the Dhruva binary-frame event name (`DHRUVA_ASR_DATA_EVENT`, default `data`) is unconfirmed with BHASHINI.
11. **`pages.sample` is never cleared.** Seed pages are inserted with `sample = true` and nothing in the API or console sets it to false, so even a published seed page shows a "review build" tag in the workbench bar, is counted by `GET /stats/public`, and would be reset to draft by `SEED_REFRESH_PAGES=1`. New pages created in the console have `sample = false`. Decide whether publishing should clear it.
12. **Sahayak chat prompt gender.** `systemPrompt` in `apps/api/src/sahayika/engine.ts` still says "you are female, use feminine verbs", while the guide is male and the Hindi lines are gender-neutral. Only affects the `hi` text of LLM answers.
13. **Hero video is 5 MB**; compress for production.
14. **Inline "Hindi Pakhwada" mentions** remain in `content/strings.en.json` (landing kicker, rewards, privacy note, Hall of Fame, certificate body), in the certificate line "CAG × BHASHINI · HINDI PAKHWADA" (`apps/api/src/certificate/render.ts`), and in console result labels. Confirm the contest name with CAG.
15. **Certificate styling** still uses the first-iteration orange/blue and a specimen signatory; there is no page to verify the verification ID.
16. **Unverified platforms:** Safari, iPhone, iPad, Edge, WebKit, and the phone suggestion strip on real devices. Phone behaviour was only checked with a Chrome phone-size profile.
17. **OCR route is a stub** (`POST /admin/pages/:id/ocr` always returns 501, even in the Docker image). The ingest wizard covers PDF text-layer segmentation and manual entry only; the Report 38 bundles came from the offline pipeline (section 6).
18. **No web unit tests.** `@hc/web` has a `test` script but no test files; `pnpm -r test` fails because of it.
19. **Dead code:** the InScript constants (`INSCRIPT*`) in `packages/shared/src/xlit.ts`. `scoring.provider: "anuvad"` is accepted by the schema but nothing implements it.
20. **Contradictions between DECISIONS.md and code:** none found that change behaviour. DECISIONS.md decision numbering contains two "Iteration 5" headings (the landing page and the workbench restyle); both are correct. Entry 58 supersedes the "female" voice in the old spec; the code matches entry 58.

## 6. Map of the codebase: where to change X

| To change | Edit | Notes |
|---|---|---|
| Levels, credits, times, titles, pass mark, weights, chances, unlock rule | `config/game.config.json` (file defaults); console → Evaluation & settings for overrides | Console overrides are stored in `config_overrides` and win over the file. Boot validation: credits total 50, weights total 100 |
| UI copy (English) | `content/strings.en.json`, then `strings.onboarding.en.json` (registration, Training Ground, Rules), then `strings.workbench.en.json` (workbench); merge order is en ← onboarding ← workbench (`apps/web/src/lib/strings.ts`) | `strings.hi.json` is a fallback only. API-side strings come from `apps/api/src/content.ts` (`str`, `strings`) |
| Sahayak lines | `content/sahayika.script.json` (defaults) or console → Sahayak (stored in `sahayika_lines`, wins over the file; also removes stale audio) | Section/moment IDs are referenced by code: `apps/web/src/screens/Round.tsx`, `apps/api/src/game.ts`, `packages/shared/src/rules.ts` |
| Sahayak chat, hints, guard | `apps/api/src/sahayika/engine.ts` | `chatbotRules`, `knowledge`, `faq` are in the script |
| Voice (TTS) | `config.bhashiniServices` (`ttsEnglish`, `ttsGender`), `DHRUVA_TTS_SERVICE_ID`; browser voice choice in `apps/web/src/lib/voice.ts` | Restart the API; regenerate audio in the console |
| Glossary matching and inline menu | `packages/shared/src/glossary.ts` (normaliser, n-gram matching, scoring check), `apps/api/src/pages.ts` (index, `computeExtras`, what is offered inline), `reference/glossary-matching-algorithm.md` (the spec); UI in `apps/web/src/round/GlossMenu.tsx`, `PageViews.tsx` | One normaliser must build both the index keys and the text keys |
| Scoring | `packages/shared/src/scoring.ts` (`scoreAttempt`, chrF, grammar issues, time); constants in config; tests in `packages/shared/test/scoring.test.ts` | Credits, unlock rule, report-card line choice: `packages/shared/src/rules.ts` |
| Game rules (start, autosave, submit, report) | `apps/api/src/game.ts`; routes `apps/api/src/routes/play.ts` | The auto-submit job is in `apps/api/src/app.ts` |
| Workbench | `apps/web/src/screens/Round.tsx` (page), `apps/web/src/round/` (`Workbench.tsx` rows and QA, `PageViews.tsx` parts/tables/figures, `Hud.tsx`, `PageControl.tsx`, `GlossMenu.tsx`, `ChatPanel.tsx`, `useAttempt.ts` autosave, `useFairPlay.ts`), editor in `apps/web/src/editor/` (`TranslationEditor.tsx`, `extensions.ts` locked tokens and paste rules, `voice.ts`) | Workbench CSS classes (`hc-*`) are in `apps/web/src/index.css` |
| Roman to Hindi | Client `apps/web/src/editor/TranslationEditor.tsx`; proxy `apps/api/src/bhashini/xlit.ts`; local fallback map `packages/shared/src/xlit.ts`; settings `config.transliteration` | |
| Fair-play rules | `apps/web/src/round/useFairPlay.ts`, `TranslationEditor.tsx`, events in `routes/play.ts` | |
| Screens | `apps/web/src/screens/*`, onboarding pieces in `apps/web/src/components/Onboarding.tsx`, landing journey `screens/landing/JourneyPath.tsx` | Routes in `apps/web/src/main.tsx` |
| Console | `apps/web/src/manager/*` (UI); `apps/api/src/routes/admin.ts`, `apps/api/src/admin/analytics.ts`, `admin/players.ts` (API) | Console labels are hard-coded English |
| BHASHINI calls | `apps/api/src/bhashini/client.ts` (translate, TTS, LLM, ASR, masks, circuit breaker); `routes/services.ts` (ASR relay, chat, TTS endpoints) | |
| Content (pages, bundles) | Console → Content library; offline pipeline `scripts/content/` and `apps/api/src/scripts/build-bundles.ts`; seeds in `seed/pages/` | See section 7 |
| Data model | `apps/api/src/schema.sql` (idempotent, run at every start); shared types `packages/shared/src/types.ts` | No migration tool; add `ALTER … IF NOT EXISTS` lines |
| Auth and OTP | `apps/api/src/auth.ts`, `routes/player.ts`, `env.ts` | |
| Certificate | `apps/api/src/certificate/render.ts`, `strings.certificate`, `assets/brand/`, `assets/fonts/` | |
| Forbidden words | `packages/shared/src/forbidden.ts`, `scripts/scan-forbidden.ts` | |
| Deployment | `docker-compose.yml`, `deploy/` | Unverified |

## 7. Adding or refreshing content

- **Through the console** (supported path for a single page): Content library → Add a report → upload the English PDF and choose a page → the text-layer segmenter proposes parts → create a draft → in the bundle editor enter and verify the Hindi references, generate drafts, mark slips, pick glossary terms, publish.
- **Bundles of 10/20/30 pages** came from the offline pipeline in `scripts/content/` (`BRIEF.md`) and `build-bundles.ts` (`corepack pnpm --filter @hc/api exec tsx src/scripts/build-bundles.ts [--no-draft]`, needs a populated `scripts/content/work/`, Python with PyMuPDF for segmentation, and optionally network access to the Anuvaad pipeline for drafts, cached in `work/drafts.json`). Copy the resulting JSON into `seed/pages/` and, in development, set `SEED_REFRESH_PAGES=1` once to reload. For production, import through the console (`POST /admin/pages` accepts the seed JSON format) so rows are created with `sample = false`.
- CAG's Hindi references were **transcribed from the Hindi PDF images** because its text layer is broken; they all need human verification.
