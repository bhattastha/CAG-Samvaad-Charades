# Runbook

## Local (no Docker needed)
```bash
corepack pnpm install
cp .env.example .env        # dev: NODE_ENV=development, SEED_ALLOW_UNVERIFIED=1, ADMIN_EMAILS=you@cag.gov.in
node scripts/copy-fonts.mjs # certificate fonts
corepack pnpm dev           # API :8787 (embedded Postgres in .data/) + web :5173
```
Open http://localhost:5173 — OTP is `123456` in development. Console: http://localhost:5173/manager with an `ADMIN_EMAILS` address.
Reset local data: stop the servers, delete `.data/`.

## Production (India-region VM)
```bash
cp .env.example .env   # set POSTGRES_PASSWORD, JWT_SECRET (32+ random chars), SMTP_URL, OTP_FROM, ADMIN_EMAILS,
                       # SITE_ADDRESS, DHRUVA_* keys, ALLOWED_EMAIL_DOMAINS; NODE_ENV=production; SEED_ALLOW_UNVERIFIED=0
docker compose up -d --build
```
Services: `db` (Postgres 16), `api` (Node 20 + tesseract hin + poppler + Chromium), `web` (nginx: static + /api proxy incl. websockets), `caddy` (HTTPS + HSTS). The API migrates and seeds reference data (offices, glossary, overrides, seed pages as drafts) on every start; it is idempotent.

## Before launch checklist
1. Manager verifies every part of ≥ 3 pages per round, generates BHASHINI drafts, marks slips, publishes.
2. Console → Sahayika → "Regenerate audio" (needs `DHRUVA_TTS_KEY` + `DHRUVA_TTS_SERVICE_ID`).
3. CAG Hindi cell confirms D3 overrides (console → Glossary → flagged).
4. Review every string listed in `content/strings.hi.json` → `_authoredInSpec_reviewBeforeLaunch`.
5. `pnpm --filter @hc/web build && pnpm scan:forbidden` and the API tests pass in CI.
6. Rotate any key that was ever in a client bundle (§16).

## Operations
- Results / credits export: console → Results → "Export credits (xlsx)".
- Stuck attempts are auto-submitted every 30 s after deadline + 30 s grace, from the last autosave.
- Service health (circuit breakers per BHASHINI task): console dashboard.
- Audit trail of every admin action: console → Audit log.
