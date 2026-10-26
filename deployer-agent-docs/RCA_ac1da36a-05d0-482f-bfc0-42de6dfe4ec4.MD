# RCA — bhashini-game (Samvaad Charades) deploy failure

**Run:** ac1da36a-05d0-482f-bfc0-42de6dfe4ec4 (type: initial)
**Failing step:** `deploy_k8s` — "deployment failed to become ready: timed out waiting for the condition"
**Verdict:** NOT a build/manifest bug. The app boots into a crash loop because it has **no reachable PostgreSQL** and the embedded PGlite fallback OOMs on tier_0. Needs a user/config fix + redeploy.

## What the app actually is
- The deployment uses the FARM template (`fastapi_react_mongo_shadcn_base_image`), but the real backend is a **Node/Fastify + PostgreSQL** monorepo app.
- `backend/server.py` is only a **FastAPI proxy shim**: it starts the bundled Node API (`backend/hc/api.mjs`) on `127.0.0.1:3000` and forwards `/api` + `/health` to it.
- `/health` proxies to the Node API's `/api/health`. If the Node process has exited, the shim returns **503** immediately (`proc.poll() is not None`).

## Root cause (evidence-backed)
1. `backend/.env` hardcodes `DATABASE_URL=postgres://hc:***@127.0.0.1:5432/hindi_charades` — a **localhost Postgres that does not exist** in the production pod. (There is no Postgres in the container; the template only provides Mongo.)
2. Every boot the shim logs: *"DATABASE_URL is not reachable: using embedded PGlite at /app/backend/.data/pglite. Data will NOT survive a redeploy or pod restart. Set DATABASE_URL to an external PostgreSQL."* → it falls back to **embedded PGlite (WASM Postgres)** and cold-initializes schema + seeds sample data on every start.
3. That cold PGlite init/seed under the production Node runtime (nodejs-wheel v22.20.0) spikes memory **past tier_0's 512Mi limit**, and the Node child is killed before it can bind :3000.
   - Prod pod logs (run ac1da36a) show the shim's uvicorn + PGlite-fallback lines repeating, but the Node API's **"Server listening at http://127.0.0.1:3000" line never appears** — the Node process never gets up.
   - Reproduced in an isolated sandbox: running `hc/api.mjs` with the exact prod node (v22.20.0) against a **clean** PGlite dir repeatedly killed (exit 137 / pod OOM) even a sandbox pod that has MORE memory than tier_0's 512Mi. Re-using a pre-seeded `.data` dir under node v20 worked — confirming the cost is the cold WASM-Postgres seed, not the app code.
4. Node dead → shim `/health` → 503 → nginx `/health` → 503 → k8s readiness/startup probe never passes → **CrashLoopBackOff** (`get_pod_events`: "Back-off restarting failed container", 26 restarts) → `deploy_k8s` times out.

Earlier run 9d351ec2 shows the same signature explicitly: `GET /health 503 Service Unavailable` + nginx `connect() failed (111: Connection refused) ... upstream 127.0.0.1:8001/health`.

## Why it worked in preview but not prod
In preview the app runs against a real Postgres (and/or a warm, already-seeded PGlite data dir) and has more headroom. In prod there is no Postgres, DATABASE_URL points at localhost, and tier_0 is 50m/250m CPU + 200Mi/512Mi memory with 2 replicas.

## Fix (required before redeploy)
**Primary — provide an external PostgreSQL (user action):**
- Provision a managed Postgres (Neon / Supabase / RDS, etc.).
- In Deployment Panel → Secrets, set `DATABASE_URL` to that external connection string (e.g. `postgres://USER:PASS@HOST:5432/DBNAME?sslmode=require`). This overrides the baked-in localhost value at deploy time.
- This is the intended production path (the app itself prints "Set DATABASE_URL to an external PostgreSQL"). It also removes the heavy in-process PGlite WASM, so memory drops well within tier_0, and it fixes a second latent bug: with embedded PGlite + 2 replicas each pod has its own throwaway DB, and all data is lost on every restart/redeploy.
- Also set the other app config the Node API expects as real secrets: `JWT_SECRET`, `PUBLIC_ORIGIN` (should be the production URL, not the preview URL currently in `.env`), `ADMIN_EMAILS`, `EMERGENT_EMAIL_KEY`, `DHRUVA_API_KEY`.

**Secondary (optional, not a real fix on its own):** raising the tier gives PGlite enough memory to finish seeding, but PGlite remains ephemeral and per-replica — do NOT rely on this for a production app. External Postgres is the correct fix.

After `DATABASE_URL` is set to a reachable external Postgres, redeploy. No source or manifest change is required from the deployer side.
