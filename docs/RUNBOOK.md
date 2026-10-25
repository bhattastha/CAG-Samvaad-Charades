# Runbook

Use `corepack pnpm` for every command (it runs the pnpm version pinned in `package.json`). Run from the repo root (`hindi-charades-kit/`). Read `docs/HANDOVER.md` first for status and the go-live checklist.

## 1. Install and run locally (no Docker, no Postgres)

Prerequisites: Node 20 or newer (built on Node 24); Chrome or Chromium for the certificate (`CHROME_PATH` if not in a standard location).

```bash
corepack pnpm install
cp .env.example .env
corepack pnpm dev        # API http://127.0.0.1:8787 and Vite http://localhost:5173
```

- With `DATABASE_URL` empty the API uses embedded PGlite files under `.data/pglite`. On every start it creates or updates the schema and loads offices, glossary, overrides and any missing seed page (idempotent).
- Development OTP is `123456` when `NODE_ENV=development` and `SMTP_URL` is empty.
- Seed pages are drafts; to play them locally set `SEED_ALLOW_UNVERIFIED=1`.
- Manager console: add your email to `ADMIN_EMAILS`, restart the API, open `/manager`.
- Vite proxies `/api` (including websockets) to the API on 8787.

## 2. Environment variables (names only; never commit values)

| Variable | Meaning |
|---|---|
| `NODE_ENV` | `development` (default), `test`, or `production` |
| `PORT`, `HOST` | API listen address (default 8787 / 127.0.0.1; the Docker image sets `0.0.0.0`) |
| `DATABASE_URL` | `postgres://…` for PostgreSQL; empty = PGlite under `.data/` |
| `JWT_SECRET` | Session signing secret; **required in production** (32+ random characters). Dev has a built-in placeholder |
| `PUBLIC_ORIGIN` | Public site origin |
| `COOKIE_SECURE` | `1` to mark the session cookie Secure; defaults to on in production, off elsewhere |
| `SMTP_URL`, `OTP_FROM` | nodemailer URL and sender for OTP email. **Required in production**; empty in development means the fixed code |
| `ALLOWED_EMAIL_DOMAINS` | Optional comma-separated domains allowed to sign up |
| `ADMIN_EMAILS` | Comma-separated manager emails (also seeded into `admin_users`) |
| `DHRUVA_API_KEY` | ULCA inference key; used for ASR, TTS, LLM (and NMT if `translationProvider` is `dhruva`). Server-side only |
| `DHRUVA_ASR_KEY`, `DHRUVA_NMT_KEY`, `DHRUVA_TTS_KEY`, `DHRUVA_LLM_KEY` | Optional per-task keys that override `DHRUVA_API_KEY` |
| `DHRUVA_TTS_SERVICE_ID` | Optional override of the TTS service ID in config (`bhashiniServices.ttsEnglish`) |
| `DHRUVA_ASR_DATA_EVENT` | Socket.IO event name for audio frames to Dhruva ASR (default `data`; unconfirmed with BHASHINI) |
| `ANUVAAD_XLIT_AUTH` | Optional `Authorization` value for the Anuvaad pipeline (drafts and transliteration); it worked without one on 23 Oct |
| `SEED_ALLOW_UNVERIFIED` | `1` lets unverified sample pages be played (development only; the server refuses to start with it in production) |
| `SEED_REFRESH_PAGES` | `1` reloads seed pages over rows with `sample = true` on start (development only) |
| `CHROME_PATH` | Chrome/Chromium for the certificate |
| `WEB_DIST` | Directory of the built web app for the API to serve (default `apps/web/dist` when it exists) |
| `POSTGRES_PASSWORD`, `SITE_ADDRESS` | Docker Compose only |

Restart the API after any `.env` change. Models, service IDs and everything else game-related are in `config/game.config.json` (read at boot).

## 3. Tests and checks

```bash
corepack pnpm --filter @hc/shared test     # scoring, unlock rules
corepack pnpm --filter @hc/api test        # journey, contract, admin (in-memory PGlite)
corepack pnpm typecheck                    # all packages
corepack pnpm build                        # tsc + vite build of the web app
corepack pnpm scan:forbidden               # forbidden names/imagery in bundle, content, config, assets
corepack pnpm dev                          # terminal 1
corepack pnpm e2e                          # terminal 2: Playwright chrome + phone-chrome
corepack pnpm exec playwright test --project=webkit --project=iphone   # Linux CI only (WebKit crashes on the build Mac)
```

Do not run `corepack pnpm test` at the root: `@hc/web` has no test files, so the recursive run fails. The e2e expects `levels.unlockRule` to be `all-open` and uses the dev OTP. `SHOTS_DIR=/some/dir` makes it save screenshots.

## 4. Seed data

```bash
corepack pnpm seed       # same as what the API does on start: migrate + load reference data
```

Loads `seed/offices.json`, `seed/glossary.json`, `seed/glossary_overrides.json` (pending CAG confirmation), and every `seed/pages/*.json` that does not exist yet, as `draft` with `sample = true`. Existing pages are not touched unless `SEED_REFRESH_PAGES=1` and the row still has `sample = true`.

## 5. Build the report bundles (offline content pipeline)

The Primary/Secondary/Professional bundles come from transcribed page files in `scripts/content/work/<bundle>/page_<pdf>.json` (see `scripts/content/BRIEF.md`; English segmentation by `scripts/content/segment_en.py`, which needs Python with PyMuPDF).

```bash
corepack pnpm --filter @hc/api exec tsx src/scripts/build-bundles.ts            # with Anuvaad drafts (cached in work/drafts.json)
corepack pnpm --filter @hc/api exec tsx src/scripts/build-bundles.ts --no-draft # without calling the pipeline
```

Writes `seed/pages/{primary,secondary,pro}_r38_bundle.json` and copies figure crops to `apps/web/public/figures/`. Then reload with `SEED_REFRESH_PAGES=1` (development) or import through the console. Every part must still be verified by a manager before publishing.

## 6. Reset test data

- One player: console → Players → reset (retype the email to confirm).
- Everyone: console → Evaluation & settings → Danger zone → type `RESET ALL TEST DATA`. Deletes all players and play data; content, glossary and offices stay.
- Fresh database: stop the servers and delete `.data/` (then restart; seed reloads).

## 7. Voice audio

Console → Sahayak → Regenerate audio pre-generates WAV files for spoken lines without placeholders into `.data/audio/` (needs `DHRUVA_API_KEY`). Lines with placeholders use live TTS. Saving a line in the console deletes that line's audio file. Persist `.data/` in production.

## 8. Docker / production (NOT VERIFIED)

`docker-compose.yml` defines `db` (Postgres 16), `api` (Node 20; installs tesseract, poppler and Chromium), `web` (nginx: static files and `/api` proxy including websockets) and `caddy` (HTTPS and HSTS). **These files and everything in `deploy/` were written but never built or run: Docker is not installed on the build machine, and the PostgreSQL path has only been exercised through PGlite.** Expect to fix them. Intended use:

```bash
cp .env.example .env   # set POSTGRES_PASSWORD, JWT_SECRET, SMTP_URL, OTP_FROM, ADMIN_EMAILS, SITE_ADDRESS,
                       # DHRUVA_API_KEY, ALLOWED_EMAIL_DOMAINS; NODE_ENV=production; leave SEED_* unset
docker compose up -d --build
```

The OCR route is a stub even though the image installs tesseract. The full go-live checklist is in `docs/HANDOVER.md` section 3.

## 9. Operations

- Results and credits: console → Results & export → Export credits (xlsx).
- Stuck attempts are auto-submitted every 30 s once past deadline plus 30 s grace, from the last autosave.
- BHASHINI health (circuit breakers per task): console Overview.
- Audit trail of every admin write: console → Audit log.
- Rotate any key that has ever been shared; create your own `.env`.

## 10. Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| Changed `.env` but nothing changed | Restart the API (env is read at start) |
| Sahayak speaks old text | Saving a line deletes its audio file; if an old file remains, regenerate audio or delete `.data/audio/<id>.wav`; restart not needed. Browser may have cached: the endpoint is `no-cache`, reload |
| Voice is a robotic browser voice | No `DHRUVA_API_KEY` (or TTS failed); set the key and restart |
| `server_error` on OTP request in production | `SMTP_URL`/`OTP_FROM` not set |
| "No pages" / `no_pages` when starting a level | No published page for that level. In development set `SEED_ALLOW_UNVERIFIED=1`; in production verify and publish |
| Edited `vite.config.ts` and proxy/aliases broke | Restart Vite |
| API refuses to start | Invalid `config/game.config.json` (credits not 50, weights not 100, first level not `trial`), missing `JWT_SECRET` in production, or `SEED_ALLOW_UNVERIFIED=1` in production; the message names the problem |
| Certificate returns HTML instead of a PDF | No Chrome/Chromium found; set `CHROME_PATH` |
| `corepack pnpm test` fails at the root | Expected (web has no tests); use the `--filter` commands |
| Playwright WebKit crashes | Known on the build Mac; run on Linux CI |
| Paste in tests is rejected | A single insert over 40 characters is treated as a paste; type character by character |
