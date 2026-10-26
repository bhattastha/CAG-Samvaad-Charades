# RCA — bhashini-game deploy blocked at trigger (insufficient credits)

## Summary
The requested redeploy never started. The initial deploy trigger (`trigger_indie`) was rejected by the credit gate **before any deploy run was committed**. This is a hard, non-retryable account-billing block — not a code, manifest, secret, or infra fault with the app.

## Evidence
Trigger response:
```
{"error":{"kind":"insufficient_credits","retryable":false,
  "message":"Not enough credits. Required: 50, Available: 44.57844217920009",
  "details":{"available":44.57844217920009,"required":50}}}
```
- Required: **50** credits
- Available: **44.58** credits
- Shortfall: **~5.42** credits
- `retryable: false` — the pipeline will reject every re-trigger until the balance is topped up.

Because the trigger was rejected, no new DeployRun was created (run_id empty). The most recent committed run is `ac1da36a` (a prior failure), so there is nothing new to inspect for this attempt.

## Status of the earlier DATABASE_URL / OOM fix
The prior failures (runs `ac1da36a`, `fe3336e4`, `9d351ec2`) show the backend falling back to embedded PGlite:
`DATABASE_URL is not reachable: using embedded PGlite ...` → startup never became ready (CrashLoop/OOM-class timeout).

Per the user's report this was addressed by repointing the `DATABASE_URL` secret (live + test slots) to an external Neon PostgreSQL and copying the preview data across. **This deployer could NOT verify that fix**, because the credit gate stopped the run before pods ever started. It remains UNVERIFIED until a run actually launches.

## Root cause
Account credit balance (44.58) is below the per-deploy requirement (50). The deploy is gated at trigger.

## Fix required (user)
Top up the account so the balance is ≥ 50 credits (add at least ~6), then re-trigger the deploy. No code/manifest/secret change is needed for this specific blocker.

## After credits are added — verify (as originally requested)
Once a run goes live, confirm the Neon/DATABASE_URL fix held:
- `GET /api/health` → 200, status healthy
- `GET /api/health/db` → 200, database connected
- `GET /` and `GET /manager/glossary` → index.html
- `GET /api/stats/public` → bundles = 5
If `/api/health/db` still reports PGlite/unreachable, re-open the DATABASE_URL investigation.
