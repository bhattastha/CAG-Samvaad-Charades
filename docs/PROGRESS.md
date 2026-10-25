# Progress board — 25 Oct 2026

Status by area. **Done** = built and exercised in development (Chrome desktop and a Chrome phone-size profile, embedded PGlite). **Partial** = works with stated gaps. **Not done** = does not exist. **Not verified** = code exists but was never run in the stated environment. The history of how each area got here is in `docs/DECISIONS.md`; what to do next is in `docs/HANDOVER.md`.

## Player journey
| Area | Status | Notes |
|---|---|---|
| Landing, sign-up and sign-in (email OTP), returning-player resume | Done | Real SMTP needed in production (not configured) |
| Training Ground, Rules, level map, briefing with mic check and countdown | Done | |
| Workbench (all four levels) | Done | Document layout, inline glossary menus, rich-text subset, Mark as done, QA strip, status bar with page control and zoom |
| Roman to Hindi helper | Done | Live endpoint verified 23 Oct; phone suggestion strip not verified on devices |
| Voice typing (Trial) | Not verified | Code and fallbacks exist; never tested with a real microphone and key; Dhruva frame event name unconfirmed |
| Fair play (paste block, leave counting, fullscreen, one live window, autosave, auto-submit) | Done | iPhone has no fullscreen API by design |
| Report card, review of own answer, Hall of Fame, profile, leaderboard | Done | Leaderboard privacy is an open decision |
| Certificate (PDF/PNG/HTML) | Partial | Works with Chrome; first-iteration styling, "specimen" signatory, no verification page |
| Level 5 PhD Shodharthi | Not done | Preview only; not playable by design (Phase 2) |
| UI in Hindi | Partial | UI is English; Hindi expected from the BHASHINI website-translation plugin hook, which is disabled and never tested with a real plugin |

## Game engine and scoring
| Area | Status | Notes |
|---|---|---|
| Rules, chances, credits, stars, unlock rules (all-open and Trial-first) | Done | Unit and API tests |
| Local deterministic scorer | Done | Known loophole: an unedited draft scores high (decision open) |
| Anuvad scoring adapter | Not done | Contract never supplied |
| Sahayak script (195 lines), report-card and in-round triggers, hint engine, guarded chat | Done | LLM path needs `DHRUVA_API_KEY`; chat prompt still says "female" |
| Sahayak voice (male) | Partial | Live TTS and browser fallback work; no pre-generated audio files exist yet |

## Content
| Area | Status | Notes |
|---|---|---|
| Report 38 bundles: Primary 10, Secondary 20, Professional 30 pages; 2 Trial passages | Done (built) | **Not verified by CAG**: all parts `needs_verification`; production serves published pages only |
| Published, verified content | Not done | Nothing is publishable until a manager verifies and publishes |
| Repeated content across chances | Not done | One bundle per level |
| Railway Finance content | Not done | Supplied English and Hindi are different editions |
| Glossary (11,391 rows), offices (231), D3 overrides | Done | D3 pending CAG confirmation; office Hindi names pending |

## Console
| Area | Status | Notes |
|---|---|---|
| Overview KPIs, players, results and xlsx export, audit log, settings overrides, danger zone | Done | |
| Content library, bundle editor, publish gate, glossary, offices, Sahayak lines and chat log | Done | `pages.sample` is never cleared (see HANDOVER 11) |
| Ingest | Partial | PDF text-layer segmentation and manual entry; OCR route is a stub (501); no automatic Hindi pairing; bundles came from the offline pipeline |

## BHASHINI integration
| Area | Status | Notes |
|---|---|---|
| Anuvaad draft translation with `{n}` masks, batching, transliteration proxy | Done | About 60 of ~580 drafts miss a number |
| Dhruva TTS, ASR (stream and file), LLM | Not verified | Need `DHRUVA_API_KEY`; not exercised end to end with the rotated key |
| Resilience (timeouts, retries, circuit breaker) | Done | Console shows health |

## Quality and platforms
| Area | Status | Notes |
|---|---|---|
| Shared and API unit/contract tests | Done | Run with `--filter` (the web package has no tests) |
| Forbidden-words scan | Done | `corepack pnpm scan:forbidden` after a build |
| Playwright e2e (3 tests, Chrome and phone-size Chrome) | Done | WebKit and iPhone projects defined but never run |
| Safari, iPhone, iPad, Edge, real devices | Not verified | |
| Accessibility settings (text size, contrast, reduced motion, sound, vibration) | Done | No formal audit |

## Deployment
| Area | Status | Notes |
|---|---|---|
| Local run (PGlite, `corepack pnpm dev`) | Done | |
| Production boot rules (JWT secret, no fixed OTP, no sample content flag) | Done | Checked 25 Oct with `NODE_ENV=production` on a temp DB |
| PostgreSQL via `DATABASE_URL` | Not verified | Written, never run against a real Postgres |
| Docker Compose, Dockerfiles, nginx, Caddy | Not verified | Never built; Docker not installed on the build machine |
| HTTPS/HSTS, India-region hosting, real SMTP | Not done | Deployment tasks |
| Secrets | Done | No secrets in tracked files or git history (25 Oct); the dev `.env` key must be rotated |

## Decisions waiting for CAG
Scoring improvement-over-draft; timers for 20/30-page levels; repeated content; leaderboard privacy; Level 5 credits and format; D3 glossary overrides; contest-name mentions and certificate template; matching Railway Finance edition.
