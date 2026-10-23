# Samvaad Charades (CAG × BHASHINI)

A four-round Hindi translation game for IA&AD officers, played on real CAG audit-report pages and scored against CAG's own published Hindi. Spec: [CLAUDE.md](CLAUDE.md). Run it: [docs/RUNBOOK.md](docs/RUNBOOK.md). Status: [docs/PROGRESS.md](docs/PROGRESS.md). Deviations: [docs/DECISIONS.md](docs/DECISIONS.md).

```
apps/web        React player app + /manager console (route-split)
apps/api        Fastify API, BHASHINI proxies, Sahayika, scoring, certificate, ingest
packages/shared config schema, scoring (§11), rules, seed converter, transliteration fallback
config/ content/ seed/   game settings, all player text + Sahayika script, seed data
e2e/            Playwright journeys
```
