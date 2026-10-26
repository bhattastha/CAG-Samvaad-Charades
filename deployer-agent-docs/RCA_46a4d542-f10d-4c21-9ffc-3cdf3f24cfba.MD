# RCA — bhashini-game deploy (run 46a4d542-f10d-4c21-9ffc-3cdf3f24cfba)

## Summary
Redeploy requested after E1's code-level fix for the repeated `build_image` "cloud build: build timed out" failure. The redeploy could **not** be started: the pipeline rejected it for **insufficient credits** before any build ran.

## Timeline / Evidence
- 3 prior runs (6efdab9f, 2c755fa2, 46a4d542) all failed at `build_image` with `TIMEOUT` / `context deadline exceeded`.
  - Build logs show the hang at `#52 [frontend-build 13/14] ... retry_with_backoff yarn install ... && yarn build`.
  - Original frontend `/app/frontend/package.json` build script = `cd .. && corepack pnpm --filter @hc/web build` → pulled in the full pnpm monorepo (199KB pnpm-lock.yaml) + corepack pnpm download, which never finished inside the Cloud Build timeout window. This is the known, already-RCA'd cause (RCA_2c755fa2 / RCA_6efdab9f).
- E1 reports a code-level fix in the preview pod: frontend now self-contained (`build = node build.js` copying prebuilt `/app/frontend/site` → `build`, no pnpm/corepack/`cd ..`); backend self-contained via pip-installed Node runtime.
  - NOTE: This fix could **not** be verified in the eph sandbox — the sandbox is built from this failed run's already-pulled (pre-fix) archive, which still shows the old `cd .. && corepack pnpm` build script and no `build.js`/`site/`. The fix only reaches the build via a `force_repull` source pull.
- `resume_pipeline(force_repull=true)` returned:
  `insufficient_credits` — Required: 50, Available: 6.99.

## Root cause of the current blocker
Account credit balance (~7 ECU) is below the 50 ECU required to start this deploy run. Hard stop before `pull_source`/`build_image`.

## Fix required
1. **User** — Top up / restore account credits to at least 50 ECU (Deployment Panel → billing/credits), then redeploy. The UI ECU confirmation does not bypass the balance check.
2. Once credits are available, redeploy with a fresh source pull so E1's self-contained frontend/backend fix is picked up. The previously-timing-out `yarn install && yarn build` (corepack pnpm monorepo) path should no longer run.

## Not the cause
- Not a manifest fault. Not a platform/infra outage. The build-timeout cause was source-level and is reported fixed by E1 (unverified in sandbox for the reason above).
