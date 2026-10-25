# Samvaad Charades — hosting task (25 Oct 2026)
Task: host existing pnpm monorepo (Fastify 5 API + React/Vite web, PostgreSQL) without rebuilding. Demo 27 Oct 2026.
User choices: Emergent managed email for OTP; publish seeded Report 38 sample pages (pending: publish gate needs verification); ADMIN_EMAILS=game_admin@cag.gov.in; BHASHINI key not rotated (use current); glossary CSV must drive workbench menus (already in seed/glossary.json, all 11,686 records present).
## Done
- Install, web build, tests: shared 21/21; api 27/27 (needed --hookTimeout=120000 in this pod; default 10s hook times out).
- Preview hosting: /app/frontend/package.json start -> scripts/emergent/start.sh (local PostgreSQL 15, data /app/.data/postgres; API NODE_ENV=production on :3000 serving web+/api). /app/backend/server.py = pass-through proxy for /api (HTTP+WS) to :3000.
- OTP sender: Emergent managed email added in apps/api/src/auth.ts + env.ts (EMERGENT_EMAIL_KEY, EMAIL_FROM_NAME); SMTP path unchanged.
## Blockers / pending decisions
- Emergent native production deploy supports Python/Next.js backends + MongoDB only; no Postgres, ephemeral disk.
- Publishing requires every part verified; no manager inbox access for agent.
- DHRUVA_API_KEY / DHRUVA_TTS_SERVICE_ID not yet entered in secrets.
## 25 Oct 2026 — iteration 2
- ADMIN_EMAILS -> bhattastha.dibd@gmail.com; old game_admin@cag.gov.in admin row removed.
- Published all 5 seeded Report 38 pages (Trial x2, Primary 10pp, Secondary 20pp, Pro 30pp) at owner request: parts marked verified, audit_logs entries "hosting-agent (owner request)" note references NOT manager-verified. 6 fields (pro 4, secondary 2) have no BHASHINI draft.
- Fixed profile dropdown hidden under body: index.css `.ob-bg/.rules-room > :not(header)`; nav no-wrap.
- Glossary: all 11,686 CSV records already in seed/glossary.json (11,389 terms in DB); inline menus verified.
- Office -> address autofill verified.
- BLOCKER: Emergent email proxy now rejects @cag.gov.in (422 undeliverable_recipient). Needs CAG/NIC SMTP_URL.
- Ops: after rebuilding web dist, restart `frontend` supervisor (static routes registered at boot).
