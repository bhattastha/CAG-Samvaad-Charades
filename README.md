# Samvaad Charades (CAG × BHASHINI)

A levelled English-to-Hindi translation game for IA&AD officers, played on real CAG audit-report pages and scored against CAG's own published Hindi. Built for Hindi Pakhwada; the UI is in English and the guide is **Sahayak**.

**Levels** (credits 2 for registering + 3 + 5 + 15 + 25 = 50; 3 chances each, best score counts, title at 33/100):

| Level | Name | Time | Content |
|---|---|---|---|
| 1 | Trial | 20 min | Plain passage, voice typing allowed, no draft |
| 2 | Primary | 60 min | 10-page report bundle with a BHASHINI draft |
| 3 | Secondary | 90 min | 20-page report bundle |
| 4 | Professional | 120 min | 30-page report bundle with tables and figures |
| 5 | PhD Shodharthi | — | Phase 2 placeholder, not playable |

**Stack:** pnpm monorepo (TypeScript), React 18 + Vite + Tailwind + TipTap (web, with the `/manager` console), Fastify 5 + Zod (API), PostgreSQL 16 or embedded PGlite for local use (raw SQL), BHASHINI Anuvaad and Dhruva services called only from the server.

```
apps/web         player app + /manager console
apps/api         API, BHASHINI proxies, Sahayak, game rules, certificate, ingest, bundle builder
packages/shared  config schema, scoring, rules, glossary matching, transliteration fallback
config/ content/ seed/   game settings, all player text and the Sahayak script, seed data
scripts/         forbidden-words scan, content pipeline
e2e/             Playwright journeys
deploy/          Docker, nginx, Caddy files (never built or run)
```

## Quick start

```bash
corepack pnpm install
cp .env.example .env     # create your own; never reuse an old .env
corepack pnpm dev        # API :8787 + web http://localhost:5173
```

Development OTP is `123456`. Full steps (manager login, sample content, reset, tests) are in [docs/HANDOVER.md](docs/HANDOVER.md) and [docs/RUNBOOK.md](docs/RUNBOOK.md).

## Documentation

| Document | What it is |
|---|---|
| [docs/HANDOVER.md](docs/HANDOVER.md) | **Start here.** What is done and not, quick start, go-live checklist, known issues, code map |
| [CLAUDE.md](CLAUDE.md) | Product and build specification v2.0 (25 Oct 2026) |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Chronological log of decisions and deviations (1–58) |
| [docs/PROGRESS.md](docs/PROGRESS.md) | Status board by area |
| [docs/RUNBOOK.md](docs/RUNBOOK.md) | Install, environment, run, seed, bundles, tests, Docker notes, troubleshooting |
| `reference/` | Source inputs (concept note, sample reports, glossary algorithm note, brand originals); never served |
