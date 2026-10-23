# हिंदी शराड्स (Hindi Charades) — Concept Note and Build Specification

**CAG × Digital India BHASHINI · Hindi Pakhwada**
Version 1.1 · 23 October 2026 · Working prototype due **27 October 2026**
Audience: Claude Code (Opus 5.5) in VS Code, and the developers reviewing its work.

**What changed since v1.0 (decisions of 23 Oct 2026):**
1. Four rounds only. No fifth round.
2. Noto Sans Devanagari is the Hindi font everywhere, including the certificate. Mangal is not used.
3. Roman → Hindi transliteration is added as a **helper inside the translation editor only**, using the BHASHINI/Anuvaad pipeline endpoint in §9.
4. Sahayika's full script (194 lines, 5 sections) is now supplied, converted and renamed: `content/sahayika.script.json`.
5. Screen-by-screen specification with the 14 reference designs (§7), and experience improvements (§15).

---

## 0. How to work from this file

1. Read this whole file first. Then read `config/game.config.json`, `content/strings.hi.json`, `content/sahayika.script.json`, and **view every image** in `reference/screen-designs/`.
2. **Order of authority:** this file → Concept Note v2 (`reference/Hindi_Charades_Concept_Note_v2_22Oct2026.docx`) → screen designs → older checklist (`reference/Technical_Input_Checklist_OLDER_superseded.docx`). Where a design and the text differ, the text wins.
3. **"Must"** cannot be broken. **"Should"** is preferred; deviate only for a stated technical reason and record it in `docs/DECISIONS.md`.
4. **No hard-coded game values or player-facing text.** Round names, titles, times, credits, weights, thresholds, Hindi strings and Sahayika lines all come from `config/` and `content/`.
5. **Forbidden anywhere a player can see it** (UI, certificate, audio, served file names, page titles): तरकश, Tarkash, अनुवाद समर, Anuvad Samar, गुरु, Guru, ट्रायल राउंड, प्रो राउंड, अनुवाद प्रवीण, अनुवाद आचार्य, and any bow, arrow, quiver or archery image. Add a CI test that scans the built web bundle, API response fixtures, `content/` and a rendered certificate, and fails on any match. Exclude `seed/glossary.json` and `reference/`: they are source data (the glossary contains ordinary entries such as गुरु).
6. If an item is still open (§2), build the stated default behind a config switch, log it in `docs/DECISIONS.md`, and continue.
7. Work milestone by milestone (§17). At each milestone run unit and e2e tests, update `docs/PROGRESS.md`, and commit.

---

## 1. The concept

**Purpose.** Officers of the Indian Audit & Accounts Department sharpen official Hindi translation by working on real CAG audit-report pages, in a short, staged game for Hindi Pakhwada. Each answer is compared with CAG's own published Hindi of the same page.

**Value to the player.** Counts toward appraisal, builds real translation skill, and earns credits (up to 50) for the Hindi Pakhwada contest, plus a title for each round and a certificate.

**Value to CAG and BHASHINI.** Officers practise checking and correcting BHASHINI's machine draft against CAG's standard glossary, which is the same skill the CAG-BHASHINI Anuvaad workflow depends on.

**Who plays.** IA&AD officers only. One officer, one player; the email ID is the unique ID.

**The four rounds** (fixed order; a round opens once the previous one has been played at least once):

| Key | Name on screen | Title (≥ 33/100) | Time | What is on the page | BHASHINI draft | Voice | Credit cap | Completion counted by |
|---|---|---|---|---|---|---|---|---|
| trial | परख राउंड | अनुवाद पथिक | 20 min | Plain passage, ≈ 300 words / 20 sentences | No, translate from scratch | Yes | 3 | Sentences ending in । |
| primary | प्राथमिक राउंड | अनुवाद निपुण | 1 hr | One page: header, heading, body, footnote, footer, page no. | Yes, check and improve | No | 5 | Parts ticked ✓ |
| secondary | माध्यमिक राउंड | अनुवाद विद्वान | 1.5 hr | Above + headnote, table, annexure reference | Yes | No | 15 | Parts ticked ✓ |
| pro | वृत्तिक राउंड | अनुवाद विशेषज्ञ | 2 hr | Full page incl. chart (title, labels, source) and table | Yes | No | 25 | Parts ticked ✓ |

Registration earns 2 credits: 2 + 3 + 5 + 15 + 25 = **50**. Each round can be played **3 times** (मौका 1/3, 2/3, 3/3); the **best** score counts and a lower later score never reduces credits. Numbers, years and rupee amounts are never changed; officers translate only the words.

**Prototype scope (27 Oct).** The full player journey end to end on live BHASHINI services (draft generation, transliteration helper, voice in परख, Sahayika voice and chat), report cards, best-of-three credits, certificate download, and a working game-manager console. Thousands of concurrent players is out of scope; correctness and fairness are in scope.

**Devices (must).** Chrome and Edge on Windows, Safari on macOS, iPhone and iPad. Mouse, touch and physical keyboard. HTTPS only.

---

## 2. Decisions and open items

| # | Item | Status / what to build | Owner |
|---|---|---|---|
| D1 | Fifth round (पीएचडी/शोधार्थी) in the older checklist | **Closed: not built.** Four rounds only. | Decided 23 Oct |
| D2 | Older names and titles (Tarkash, Guru, प्रवीण, आचार्य) | **Closed:** v2 names only (§1). Script converted. | Decided |
| D3 | *Annexure*: glossary file says संलग्नक; Concept Note and Sahayika script say **अनुलग्नक** and teach "Appendix = परिशिष्ट" | Seeded override `seed/glossary_overrides.json`: Annexure → अनुलग्नक, Appendix → परिशिष्ट, Report → प्रतिवेदन (avoid रिपोर्ट). Status `pending_confirmation`; one click in the console to revert. | CAG Hindi cell |
| D4 | Fonts | **Closed:** Noto Sans Devanagari (Hindi) and Noto Sans (Latin), self-hosted, everywhere incl. certificate. | Decided 23 Oct |
| D5 | Anuvad evaluation API contract not supplied | Local deterministic scorer (§11) behind `scoring.provider`; Anuvad adapter stub with 5 s timeout and fallback. | BHASHINI |
| D6 | Transliteration payload sets `targetLanguageScriptCode: "Latn"` for an en → hi request | Build exactly as supplied (§9.2) with the value in config. If the live response comes back in Latin script, switch the config value to `"Deva"`; the client also rejects any suggestion with no Devanagari characters. | BHASHINI |
| D7 | Credentials for the Anuvaad transliteration endpoint not stated | API reads optional `ANUVAAD_XLIT_AUTH` and sends it as `Authorization` when set. | BHASHINI |
| D8 | Offices CSV has no Hindi names; 186/231 have no street address | Show Hindi name when present, else English; pre-fill address as "City, State – PIN", editable. Console job batch-translates names for review. | CAG |
| D9 | Credits below 33 | Formula still applies, no title (`creditsBelowPassMark: true`). | CAG |
| D10 | Login | Email + OTP, pluggable sender; fixed code only in development. SSO adapter left empty. | CAG / NIC |
| D11 | Hosting | India region only (NIC MeghRaj or BHASHINI infra); no runtime third-party CDNs. | BHASHINI DevOps |
| D12 | Not yet supplied: manager mockups, certificate template PDF, high-res logos | Console per §8; certificate per §13; low-res logo placeholders in `reference/brand/`. | Project team |

---

## 3. Facts about the supplied data (they shape ingestion)

**Sample report pair** (`reference/sample-report/`, Report No. 38 of 2025, Blast Furnaces in SAIL, Commercial):
- English PDF (90 pp.) has a clean text layer.
- Hindi PDF (116 pp., Mangal) has a **broken text layer** (e.g. `ककया` for किया). Never use extracted Hindi text as a scoring reference.
- OCR (`tesseract`, `hin`, tessdata_best, 300 dpi) reads Hindi words well but drops digits (`18.73` → `8.73`). Numbers are identical in both editions, so repair OCR numbers by aligning them, in order, with the English segment's numbers; then a manager verifies every segment.
- The Hindi edition is longer (body to printed p. 81 vs 59): pages do not align. Pair segments by anchors: section numbers, `Table n` ↔ `तालिका n`, `Chart-n` ↔ `चार्ट-n`, footnote numbers, number sequences.
- No annexure references in Report 38, so माध्यमिक needs pages from another report. Only printed page 2 has both a chart and a table (वृत्तिक candidate). Tables: pp. 10, 24, 26, 27, 43, 44, 49, 53. Charts: 3, 4, 11, 14, 21, 22, 31–33.

**Glossary** (`seed/glossary.json`, from `anuvaad-webapp-glossary_entries.xlsx`): 11,686 rows → 11,390 entries (279 case/duplicate merges). "Other target terms" mix real alternatives with machine transliterations of the English (डिपार्टमेंट, ऑडिट, एनेक्सर). The seed splits them into 6,237 `accepted_variants` and 11,043 `avoid_forms` using consonant-skeleton similarity (threshold 0.7). 631 primaries look transliterated (flagged); 3 are empty after cleaning (excluded until fixed). The importer must apply the same rules to any new upload.

**Offices** (`seed/offices.json`): 231 active (226 field offices, 5 HQ), 33 states/UTs. Office-admin names and emails in the CSV are **not** imported.

---

## 4. Architecture and stack

| Layer | Choice | Reason |
|---|---|---|
| Repo | pnpm monorepo, TypeScript strict | Shared types and pure rule/scoring functions |
| Web | React 18, Vite, Tailwind, React Router, TanStack Query, Zustand | Fast build; runs on all target browsers |
| Translation editor | TipTap (ProseMirror) | Atomic undeletable number chips, paste/drop hooks, custom input for transliteration and InScript |
| API | Node 20, Fastify, Zod | Typed, validated routes |
| Database | PostgreSQL 16 + Prisma | Unique constraints enforce chances |
| Realtime | `ws` browser ↔ API; `socket.io-client` API ↔ Dhruva ASR | Keys stay server-side |
| Ingestion | poppler-utils, tesseract-ocr + `hin` in the API image | §8 |
| Certificate | Playwright (headless Chromium) renders HTML → PDF/PNG | pdf-lib/pdfkit mis-shape Devanagari conjuncts |
| Tests | Vitest; Playwright (Chromium + WebKit) | WebKit approximates Safari/iOS |
| Run | Docker Compose: `db`, `api`, `web` (nginx), `caddy` (HTTPS) | One command locally and on an India-region VM |

```
hindi-charades/
  CLAUDE.md
  config/game.config.json            single settings block
  content/strings.hi.json            all player-facing text
  content/sahayika.script.json       194 lines + knowledge + FAQ + chatbot rules
  seed/offices.json  seed/glossary.json  seed/glossary_overrides.json  seed/pages/*.json
  reference/                         inputs only; never served
  apps/web/                          player app + /manager (route-split bundle)
  apps/api/src/{routes,rules,scoring,bhashini,xlit,sahayika,ingest,certificate,jobs}
  apps/api/prisma/schema.prisma
  packages/shared/                   Zod config types, rules, scoring, string/script loader
  assets/fonts/ (Noto Sans Devanagari, Noto Sans, subset WOFF2)   assets/brand/
  docs/DECISIONS.md  docs/PROGRESS.md  docs/RUNBOOK.md
  docker-compose.yml  .env.example
```

---

## 5. Configuration

`config/game.config.json` contains v2's settings block verbatim plus build settings: `creditsBelowPassMark`, `roundUnlockRule`, `fairPlay` (warnings at 5 min and 1 min, 4 s submit-confirm window, 10 s autosave, 30 s deadline grace), `stars`, `sahayika` (LLM service, quick questions, chat limit), `glossary` (avoid threshold), `scoring` (provider, chrF constants), `auth`, `transliteration` (§9.2).

Must: validate with Zod at boot and refuse to start if invalid or if `registration.credits + Σ creditCap ≠ maxCredits`; expose a public subset at `GET /config`; manager edits to credit caps go to an audited override table.

---

## 6. Data model (Prisma outline)

```prisma
model Player   { id String @id @default(cuid()); email String @unique; name String; mobile String
                 officeId String; officeAddress String; registeredAt DateTime @default(now()); registrationCredits Int }
model Office   { id String @id; nameEn String; nameHi String?; type String; city String; state String
                 pincode String?; address String; addressComposed Boolean }
model GlossaryTerm { id String @id @default(cuid()); en String; enNorm String @unique; hi String
                 acceptedVariants String[]; avoidForms String[]; flags String[]; override Json? }
model Page     { id String @id; roundKey String; label String; printedPageNo String?
                 sector String                      // stored, NEVER sent to the client
                 source Json; status PageStatus; active Boolean; version Int
                 parts PagePart[]; terms PageTerm[]; slips PlantedSlip[] }
model PagePart { id String @id; pageId String; order Int; type PartType; tickGroup String
                 en String; hiReference String; bhashiniDraft String?; lockedTokens String[]
                 layout Json?; editable Boolean; referenceVerified Boolean @default(false) }
model PlantedSlip { id String @id @default(cuid()); pageId String; partId String
                 kind SlipKind; wrongText String; enTerm String?; fixHint String }   // drives Sahayika hints
model PageTerm { pageId String; termId String; @@id([pageId, termId]) }
model Attempt  { id String @id @default(cuid()); playerId String; roundKey String; chanceNo Int; pageId String
                 startedAt DateTime; deadlineAt DateTime; submittedAt DateTime?; autoSubmitted Boolean @default(false)
                 status AttemptStatus; answers Json; answersVersion Int @default(0); activeClientId String?
                 leftPageCount Int @default(0); pasteBlockedCount Int @default(0)
                 measures Json?; score Int?; tip Json?
                 @@unique([playerId, roundKey, chanceNo]) }
model AttemptEvent { id String @id @default(cuid()); attemptId String; type String; at DateTime; meta Json? }
model SahayikaLine { id String @id; section String; part String; moment String; spoken Boolean; en String; hi String; audioPath String? }
model ChatLog  { id String @id @default(cuid()); playerId String; attemptId String?; question String; en String; hi String; blocked Boolean; at DateTime @default(now()) }
model XlitStat { day DateTime; acceptedIndex Int; count Int; @@id([day, acceptedIndex]) }   // no text stored
model OtpChallenge { email String @id; codeHash String; expiresAt DateTime; tries Int }
model AdminUser { email String @id; role AdminRole }
model ConfigOverride { key String @id; value Json; by String; at DateTime }
model AuditLog { id String @id @default(cuid()); actor String; action String; target String; at DateTime; meta Json? }
enum PartType { passage header heading headnote body footnote footer page_number table_title table_cell
                table_note chart_title chart_label chart_source annexure_ref }
enum SlipKind { term transliteration grammar omission }
enum PageStatus { draft published retired }
enum AttemptStatus { active submitted }
```

Round results (best score, chances used, title, credits) are **computed** from `Attempt`, never stored. **Tick groups:** each header, heading, headnote, footer, footnote and body paragraph is one group; a whole table is one group; a whole chart is one group; page numbers and number-only cells are not editable and not counted.

---

## 7. Screens (player)

**Design system** (from the designs, adjusted for accessibility):

| Token | Value | Use |
|---|---|---|
| `--primary` | `#E8590C` | Buttons ≥ 18 px bold text, headings, bars, badges. White on it is 3.6:1, so never use it behind small text |
| `--primary-strong` | `#C2410C` | Any orange text below 18 px (5.2:1) |
| `--navy` | `#22293B` | Sahayika panels, total-score panel |
| `--cream` | `#FCF3EA` | Draft header, rule cards, pop-up time box |
| `--muted-text` | `#6B7280` | Secondary text (the designs' `#93989E` is 2.9:1, too faint) |
| `--success` | `#16A34A` | Ticks, "पूरा" badges |
| `--timer-bg` / text | `#FDECEC` / `#B42318` | Time-left chip |
| Fonts | Noto Sans Devanagari / Noto Sans | Hindi body ≥ 18 px in the editor; line-height 1.7 |
| Radius, shadow | 12 px, soft | Cards and panels |

**Global header** on every screen: CAG logo (left), "हिंदी शराड्स" with "CAG × BHASHINI" below (centre), BHASHINI logo (right). Page title in orange with a small italic English subtitle (e.g. "परख राउंड *Trial round*").

**Sahayika presence:** a card or line with her avatar (girl with graduation cap, no archery), the Hindi line, and 🔊 सुनें. Spoken lines play automatically only after the player's first tap on the title screen (browser autoplay rules); a mute toggle sits in the header and is remembered.

### 7.1 शीर्षक · Title — `reference/screen-designs/01_title.jpg`
- Left: "CAG × BHASHINI" pill, "हिंदी" (navy) "शराड्स" (orange), "HINDI CHARADES", tagline (`title.tagline`), शुरू करें.
- Right: A (navy circle) overlapping अ (orange circle), caption "English से हिंदी".
- शुरू करें → if a session exists, resume (§10.6); else registration.

### 7.2 पंजीकरण · Registration — `02_registration.jpg`
- Form "अपने बारे में बताइए": नाम, मोबाइल नंबर (fixed "+91", 10 digits, first digit 6–9), ईमेल आईडी, कार्यालय (searchable combobox over offices; search English or Hindi), कार्यालय का पता (pre-filled from the office, editable, "नया" badge when edited). All required; errors inline in friendly Hindi.
- "+2 क्रेडिट" badge top-right. Right panel: Sahayika line `before_game.screen.registration_open`, big "+2 पंजीकरण क्रेडिट", "केवल कैग अधिकारियों के लिए".
- Flow: पंजीकरण करें → OTP sent to email → 6-digit OTP field appears in place → verify → player created, 2 credits → line `registration_done` → कैसे खेलें. If the email already exists: OTP → resume where they left off.
- Privacy note below the button (`registration.privacyNote`).

### 7.3 कैसे खेलें · How to play — `03_how_to_play.jpg`
- Left: 8 numbered points (`howToPlay.points`); point 3 shows credit pills (पंजीकरण 2 · परख 3 · प्राथमिक 5 · माध्यमिक 15 · वृत्तिक 25 = 50).
- Right top: Sahayika (`how_to_play_new` or `how_to_play_returning`).
- Right bottom "लिखने के तरीके": a small **practice instance of the translation editor** (same component, practice mode, nothing saved) to try (1) Roman → Hindi with suggestions, (2) InScript on-screen keys, (3) voice (marked "केवल परख में").
- आगे → rules.

### 7.4 खेल के नियम · Rules — `04_rules.jpg`
- Four round cards from config: name, title, clock + time, typing mode line, completion line, "n क्रेडिट तक अर्न कर सकते हैं". The परख card is outlined as current.
- Three rule cards: कॉपी-पेस्ट नहीं चलेगा · हर राउंड के तीन मौके · परख के बाद सिर्फ़ टाइपिंग (bodies in `strings.rules`).
- Sahayika: `rules_open`, then `rules_credits` under the pills.
- "समझ गया, शुरू करें" → pop-up for the next playable round.

### 7.5 राउंड से पहले · Before the round (modal) — `07_pre_round_popup.jpg`
- Round name, "यह राउंड पूरा करने पर आप बनेंगे: {title}", मौका n / 3 chip, time box "इस राउंड के लिए आपके पास है: 1 hr".
- Rule lines (keyboard, lock, list, replay icons). Before प्राथमिक only, the first line is "typing only from now" and Sahayika uses `primary.pre_round.typing_only_notice`.
- Sahayika line: `first_chance` or `retry` (with `{best_score}`), plus one rotating `tip.n` (cycle by chance number).
- **परख only: microphone check here**, before the clock starts: request mic permission, show a level meter; if denied, say voice is off and keyboard works. Never prompt for permission after the clock starts.
- शुरू करें (user gesture) → request fullscreen → `POST /rounds/{key}/attempts` → round screen.

### 7.6 राउंड · Round — `05_trial_round.jpg`, `08_primary_round_bhashini_draft.jpg`, `10_secondary_round.jpg`, `12_pro_round.jpg`
- **Header:** round name, मौका n / 3, time-left chip (`mm:ss` under 1 hr, `h:mm:ss` above), "n क्रेडिट तक", autosave status ("सेव हो गया" / "सेव हो रहा है…").
- **Left panel "मूल पाठ · Source page · English":** the English page rendered with its structure (chapter line, report line, headnote box, headings, paragraphs with footnote markers, tables, charts, footnotes, footer, page number). Not selectable.
- **Right panel:**
  - परख: one editor "आपका हिंदी अनुवाद"; each finished sentence (ends in ।) gets a green ✓ at its start; "वाक्य n / 20 पूरे".
  - Main rounds: header "भाषिणी अनुवाद · जाँचें और सुधारें"; the page mirrored part by part, each part an editor pre-filled with BHASHINI's draft, a status badge ("अधूरा" / "✓ पैराग्राफ पूरा") and a ✓ toggle. Tables keep their grid: number cells read-only, word cells editable, one ✓ for the table. Charts: bars and values drawn read-only, title, axis labels, legend and source editable, one ✓ for the chart. Numbers in running text are locked chips.
  - Highlight in the draft (as design 08): avoid forms, Latin-script words, and English words in Devanagari, with a dotted underline. Highlights are hints, not answers.
- **Linked focus [§15]:** focusing a Hindi part outlines its English part, and vice versa. In परख, the sentence count position maps to the matching English sentence.
- **Bottom bar:** keyboard mode selector (रोमन से हिंदी · इनस्क्रिप्ट · डिवाइस कीबोर्ड), बोलें (परख only), शब्दावली, सहायिका, lock badge "कॉपी-पेस्ट बंद", live count, progress bar, जमा करें.
- **Phone portrait:** segmented toggle "मूल पाठ | आपका अनुवाद" switches panels; bottom bar wraps to two rows; tables scroll inside their own box.
- Sahayika in-round lines (§10.2) appear as a slim card above the bottom bar and auto-hide after 8 s.

### 7.7 रिपोर्ट कार्ड · Report card — `06_trial_report_card.jpg`, `09`, `11`, `13`
- Left navy panel: Sahayika announces (§10.3) → large orange title pill (or `title_needed_note` when below 33) → "+x क्रेडिट" and "कुल: y / 50" → 5 stars (1 for registration + 1 per title earned) "हासिल किए सितारे".
- Right card: player name, round · time · मौका n / 3, big score "84 / 100 · इस बार के अंक", three chance chips (best ★, unplayed "बाकी"), "इस बार आपने कैसा किया" with five bars and counts: अनुवाद `8 / 10 अंक`, समय `16 min / 20 min`, पूर्णता `18 / 20 वाक्य` or `5 / 6 पैराग्राफ`, शब्दावली `9 / 12 शब्द`, वाक्य संरचना `8 / 10 अंक`.
- One tip line (`tip_term` / `tip_grammar` / `tip_praise`), "पेज छोड़ा: n बार" if > 0, and after परख "अगले राउंड से सिर्फ़ टाइप करके लिखना है।"
- **"अपना अनुवाद देखिए" [§15]:** read-only view of the player's own submitted text with the flagged terms and slips underlined. Never shows the CAG reference.
- Buttons: "फिर खेलें · n मौके बाकी" (if any), next round (or "कुल स्कोर" after वृत्तिक).

### 7.8 आपका कुल स्कोर · Total score — `14_total_score.jpg`
- Left table: पंजीकरण +2; each round with title, best score, "n / 3 मौके", credits; "कुल क्रेडिट" total. Footnote "हर राउंड में आपका सबसे अच्छा स्कोर जोड़ा गया है।"
- Right navy panel: trophy, "बधाई हो, {name} जी!", total "45.1 / 50 क्रेडिट", line about Hindi Pakhwada, Sahayika (`total_open`, or `all_titles_won`, or `titles_missing`), प्रमाणपत्र डाउनलोड करें, स्कोर बढ़ाइए (opens a picker of rounds with chances left), replay note.

---

## 8. Screens (game manager console, `/manager`)

No designs were supplied; use the same design system, desktop-first. Roles: `manager` (edit, publish), `viewer` (read, export).

1. **Dashboard:** published pages per round (warn if < 3), players registered, attempts today, average best score per round, BHASHINI service health.
2. **Pages:** list with round, label, status, verified-parts count, times used; filters.
3. **Ingest wizard** (one page at a time):
   a. Upload English + Hindi PDFs (or pick from the library) and choose the English page.
   b. Auto-segment English into typed parts from the text layer; manager can split, merge, retype, reorder.
   c. Render matching Hindi pages, OCR, repair numbers, propose pairings by anchors; side-by-side editor to fix each `hiReference`; tick "reference verified" per part.
   d. Locked tokens auto-detected (Indian-grouped numbers, decimals, years like 2017-18, ₹ amounts, `(-)` negatives, percentages); add/remove by clicking.
   e. Generate BHASHINI draft (numbers masked before sending, restored after); edit per part.
   f. **Planted slips:** mark wrong words in the draft by kind (term, transliteration, grammar, omission) with the English term and a fix hint. These feed Sahayika's hints and the draft highlights.
   g. Glossary terms for the page: auto-suggested (English term on the page and its Hindi in the reference), manager ticks the final list.
   h. Preview exactly as a player sees it; publish (blocked until every part is verified).
4. **Glossary:** search, edit, overrides (with reason and status), import (this xlsx format and CSV `english_term, hindi_term, accepted_variants, category`), flagged entries queue.
5. **Offices:** import CSV, batch-translate names, review.
6. **Sahayika:** all lines by section/moment, edit text, regenerate audio, play; chat log with blocked answers first.
7. **Results:** players, per-round best, chances, titles, credits; **Export credits (xlsx)**: email, name, mobile, office, best score and credits per round, titles, total.
8. **Settings:** effective config (read-only) and audited credit-cap edits.

---

## 9. BHASHINI integration

**All calls go through the API. No key or token ever reaches the browser.** (The Shrutlekh reference in `reference/BHASHINI_Dhruva_API_reference_Shrutlekh.pdf` shows keys shipped in client code; do not repeat that.) Env vars: `DHRUVA_ASR_KEY`, `DHRUVA_NMT_KEY`, `DHRUVA_TTS_KEY`, `DHRUVA_LLM_KEY`, `ANUVAAD_XLIT_AUTH` (optional). Dhruva auth header is the **raw token**: `Authorization: <token>` (not `Bearer`).

### 9.1 Endpoint catalogue

| Use | When | Endpoint |
|---|---|---|
| Translation en→hi | Console batch only, never during play | `POST https://dhruva-api.bhashini.gov.in/services/inference/pipeline` |
| Transliteration en→hi | Live, translation editor only | `POST https://anuvaad-backend.bhashini.co.in/v1/pipeline` |
| ASR hi, streaming | परख voice typing | Socket.IO `wss://dhruva-api.bhashini.gov.in`, path `/socket.io` |
| ASR hi, file | Fallback if streaming fails | Pipeline endpoint, `taskType: "asr"` |
| TTS en, female | Sahayika audio | Pipeline endpoint, `taskType: "tts"` (service ID from BHASHINI) |
| LLM | Sahayika chat | `POST https://dhruva-api.bhashini.gov.in/services/inference/llm` |

**Translation (batch):**
```bash
curl -X POST https://dhruva-api.bhashini.gov.in/services/inference/pipeline \
  -H "Accept: application/json" -H "Content-Type: application/json" \
  -H "Authorization: $DHRUVA_NMT_KEY" \
  -d '{"pipelineTasks":[{"taskType":"translation","config":{
        "language":{"sourceLanguage":"en","targetLanguage":"hi"},
        "serviceId":"ai4bharat/indictrans-v2-all-gpu--t4"}}],
       "inputData":{"input":[{"source":"The Department did not monitor the progress of works."}]}}'
# → pipelineResponse[0].output[i].target
```
Batch 25 parts per call, 5 calls in parallel. Mask locked tokens as `⟦0⟧, ⟦1⟧…` before sending and restore after; if a mask is lost, flag the part for manual fixing.

**ASR streaming (परख):** browser AudioWorklet → 16 kHz mono PCM16 frames → `wss://<api>/speech/asr/stream` → API relays to Dhruva with `io(url, { path: "/socket.io", auth: { authorization: DHRUVA_ASR_KEY } })`, waits for `ready`, emits `start` `[{ taskType: "asr", config: { language: { sourceLanguage: "hi" }, samplingRate: 16000, postProcessors: ["punctuation"] } }]`, streams frames, and forwards `response` events (`pipelineResponse[0].output[0].source`, `meta.isIntermediateResult`). Intermediate text shows greyed at the caret; final text commits. Spoken "पूर्ण विराम" → `।` (no duplicate if punctuation already added). Fallback: browser Web Speech API (`hi-IN`); if neither works, `round.voiceUnavailable` and the keyboard continues.

**LLM (Sahayika):**
```bash
curl -X POST https://dhruva-api.bhashini.gov.in/services/inference/llm \
  -H "Content-Type: application/json" -H "Authorization: $DHRUVA_LLM_KEY" \
  -d '{"pipelineTasks":[{"taskType":"llm","config":{"serviceId":"bhashini/google/gemma-4-26B-A4B-it","temperature":0}}],
       "inputData":{"input":[[{"role":"system","content":"<system prompt>"},{"role":"user","content":"<question>"}]]}}'
# → pipelineResponse[0].output[0].target
```

Resilience for every call: 8 s timeout (transliteration 2.5 s), 2 retries with backoff on 5xx, circuit breaker per task. On failure show a friendly line and let the player keep typing; never lose work.

### 9.2 Transliteration helper (Roman → Hindi) — translation editor only

**Scope (must).** Active only inside the round editor and its practice instance on the How-to-play screen. Not in registration, glossary search, Sahayika chat or the console. It suggests Hindi spellings of what the player types in Roman letters; it never translates English meaning.

**API call (as supplied, via the API proxy `GET /api/xlit?word=`):**
```bash
curl -X POST https://anuvaad-backend.bhashini.co.in/v1/pipeline \
  -H "Content-Type: application/json" \
  ${ANUVAAD_XLIT_AUTH:+-H "Authorization: $ANUVAAD_XLIT_AUTH"} \
  -d '{"pipelineTasks":[{"taskType":"transliteration","config":{
        "language":{"sourceLanguage":"en","targetLanguage":"hi","targetLanguageScriptCode":"Latn"},
        "serviceId":"ai4bharat/indicxlit--cpu-fsv2","isSentence":false,"numSuggestions":4}}],
       "inputData":{"input":[{"source":"mera"}]}}'
```
Read `pipelineResponse[0].output[0].target`; accept either an array of strings or a single string. Keep only suggestions containing Devanagari (U+0900–U+097F), de-duplicate, cap at 4. All request values come from `config.transliteration`.

**API proxy rules.** Validate `word` as `^[A-Za-z]{1,30}$`; LRU cache (50,000 words, 7 days); rate limit 20 requests/s per player; 2.5 s timeout; on failure return `{suggestions: [], fallback: "<rule-based guess>"}` from a local ITRANS-style map so typing never stalls.

**Editor behaviour** (keyboard mode "रोमन से हिंदी", the default):

| Player action | Result |
|---|---|
| Types Latin letters | The current Roman word is underlined; after 150 ms debounce a popup at the caret shows up to 4 Hindi suggestions numbered 1–4, then the Roman word itself as option 5. Suggestion 1 is highlighted. |
| Space or Enter | Commit the highlighted suggestion and insert the space/newline. |
| 1–4, click or tap | Commit that suggestion. |
| ↑ / ↓ | Move the highlight. |
| Esc or option 5 | Keep the Roman word as typed (it will count as a Latin word in scoring). |
| Backspace right after a commit | Restore the Roman word so the player can pick again. |
| `.` after a word | Commit and insert `।`. `..` gives a literal `.`. A `.` between digits is never converted. |
| Digits, punctuation | Inserted as typed; never sent for transliteration. |
| Typing continues before results arrive | Stale requests are aborted; only the latest word's results show. |

**Phone/tablet:** suggestions show as a horizontal strip pinned above the on-screen keyboard instead of a floating popup. Set `autocorrect="off" autocapitalize="off" spellcheck="false"` on the editor.

**Interplay:** the glossary drawer's जोड़ें inserts Hindi directly; InScript and device-keyboard modes bypass the helper; ASR text bypasses it; paste-detection (§12) ignores insertions made by the helper.

**Telemetry:** count which suggestion index is accepted per day (`XlitStat`); never store typed words.

---

## 10. सहायिका (Sahayika)

**Character.** Friendly female guide; speaks simple, cheerful English (as to a child of 6–9, at most 3 short sentences); every line also shown in natural Hindi with feminine verbs for herself; 🔊 सुनें on every line.

**Script.** `content/sahayika.script.json` has 194 lines with stable IDs `section.part.moment[.n]`, plus `knowledge` (facts per section), `faq` (ready answers per section), `samplePageFacts`, `chatbotRules` and the placeholder list. `spoken: false` lines are shown only. Placeholders are filled server-side from the player and attempt (`{name}`, `{score}`, `{best_score}`, `{chance}`, `{chances_left}`, `{marks_short}`, `{credits}`, `{total_credits}`, `{leaves}`, `{parts_left}`, `{time_left}`, `{page_no}`, `{en_term}`, `{hi_term}`, `{wrong_word}`, `{grammar_tip}`).

### 10.1 Before the game and end screens
`before_game.screen.*`: registration_open, registration_done, how_to_play_new / how_to_play_returning, rules_open, rules_credits. `end.screen.*`: total_open, then all_titles_won **or** titles_missing (if a missing title's round has chances left) **or** the plain line; replay_note shown when any round has chances left.

### 10.2 In-round triggers (per round)

| Moment | Trigger |
|---|---|
| `pre_round.first_chance` / `retry` / `typing_only_notice` / `tip.n` | Pop-up opens (§7.5) |
| `in_round.round_start` (+ `round_start_followup`) | Clock starts; `{page_no}` = page's printed number |
| `under_source` (परख) | 90 s with no typing |
| `mic_tapped` (परख) | Mic tapped |
| `half_time` | 50% of time used |
| `half_parts_done` | Half the tick groups ticked |
| `all_done_before_submit` | All sentences (परख) or all groups ticked |
| `copy_paste_blocked` | Any blocked copy/cut/paste |
| `five_min_left`, `one_min_left` | 5 and 1 minutes left |
| `submit_with_parts_left` | First press of जमा करें with parts open |
| `left_popup_title` + `left_tab` / `left_fullscreen` + `left_count_note` | Return after leaving |
| `time_up` | Auto-submit |

### 10.3 Report-card line selection
1. Best ≥ 33: chance 1 → `title_earned_first_chance`; later chance with new best that first reaches 33 → `first_pass_on_retry`; later chance with new best → `new_best`; later chance not a new best → `not_new_best`. Then `title_name`, then `credits_line`.
2. Best < 33: if chances left and best is 28–32 → `so_close` (`{marks_short}` = 33 − best); else if chances left → `below_pass_chances_left`; else `below_pass_no_chances`. Show `title_needed_note` in place of the title pill.
3. Tip line, then `typing_only_next` after परख, `left_count_note` if the player left the page, and `pro.report_card.all_rounds_played` the first time all four rounds have been played.

### 10.4 Chat (the सहायिका button)
- Panel shows the four quick questions (`chat.quick_buttons`), input placeholder, and `thinking` while waiting. Outside a round → `opened_outside_round`.
- **Rule-based first:** "hint" → hint engine; "score", "time", "credits", "glossary" → matching ready lines with placeholders filled; a question naming a glossary term (English or Hindi) → `ask_term`. Matching FAQ questions → the FAQ answer.
- **Hint engine** (no LLM): scan the player's current text for (1) a planted slip or avoid form still present → `hint_wrong_word`; (2) a page glossary term whose Hindi is missing → `hint_missing_term`; (3) an open grammar issue from the scorer → `hint_grammar`; else `hint_all_good`. Never reveal the fix itself beyond the glossary term.
- **LLM only for other questions:** Dhruva LLM with a system prompt built from `chatbotRules`, `knowledge.before_game`, the current round's `knowledge` and `faq`, the page's glossary terms, and live facts (time left, chance, credits). Require JSON `{"en": "...", "hi": "..."}`.
- **Never** give the model the page's English body, its CAG Hindi, the draft text or the sector. Output guard: reject and use `unknown_question` if the answer contains any 5-word run from the page source or reference, a sector/department/report number, or a planted slip's fix; trim `en` to 3 sentences. Limit 20 questions per attempt. Log every Q/A.
- `samplePageFacts` show the shape of page facts (e.g. "Watch for: Revenue receipts = राजस्व प्राप्तियाँ"); at runtime these come from the page's glossary terms and planted slips, never from this sample.

### 10.5 Voice
Pre-generate audio for every spoken line without placeholders (`POST /admin/sahayika/audio`, BHASHINI TTS, English, female) and serve as files. Lines with placeholders: live TTS with a cache keyed by filled text. Fallback: `speechSynthesis` with an `en-IN` female voice; text always shows.

### 10.6 Returning players
Same email → `GET /me/progress` → active attempt (resume round), else next pop-up for the next playable round, else total score. Sahayika says `how_to_play_returning` once per session.

---

## 11. Scoring (deterministic local scorer)

Each measure is in [0, 1]. **Score = round(translation×30 + completion×20 + sentence×20 + glossary×20 + time×10)** (weights from config). Empty answer after normalisation → **0**.

Normalise: NFC; strip ZWJ/ZWNJ; `|` → `।`; collapse whitespace.

| Measure | Method | Report card |
|---|---|---|
| अनुवाद | Per part: chrF (char n-grams 1–6, β = 2) of player vs `hiReference`; calibrate `clamp((chrF − 0.20)/(0.85 − 0.20))`; length-weighted average. परख = whole passage. | `round(×10) / 10 अंक` |
| पूर्णता | परख: sentences ending `।?!` with ≥ 2 words, capped at source count. Main: ticked non-empty groups / groups. | `18 / 20 वाक्य`, `5 / 6 पैराग्राफ` |
| वाक्य संरचना | 1 − 0.05 per Latin-script word (not locked) − 0.05 per missing sentence-final `।` − 0.03 per word starting with a vowel sign − 0.02 per immediately repeated word − 0.05 per unbalanced bracket − 0.02 per source number missing (परख); floor 0. | `round(×10) / 10 अंक` |
| शब्दावली | Per page term: correct if primary or accepted variant present (with simple inflections: `ा`→`े/ों/ाओं`, `ी`→`ियों/ियाँ/ियां`, else `+ों/ें`) **and** no avoid form of that term and not the English word in Latin. Overrides (D3) apply. Value = correct / terms (1 if none). | `9 / 12 शब्द` |
| समय | `f = used / limit`; 1 if f ≤ 0.5, else `1 − (f − 0.5)/0.5 × 0.4`. | `16 min / 20 min` |

Tip = first issue in page order: term (`tip_term`) → grammar (`tip_grammar`) → praise. Credits per round = `Math.round(best × cap / 10) / 10`; check 84 × 3 → 2.5, 88 × 5 → 4.4, 88 × 15 → 13.2, 92 × 25 → 23; total 2 + 2.5 + 4.4 + 13.2 + 23 = **45.1** (matches design 14). Anuvad provider (D5) replaces translation, glossary and sentence when enabled; completion and time stay local.

Required unit tests (seed passage `seed/pages/trial_r38_page_v.json`): reference vs itself → translation 1, glossary 12/12; empty → 0; "विपणन" replaced by "मार्केटिंग" → glossary 11/12; time fractions 0.4/0.75/1.0 → 1.0/0.8/0.6; credit examples above.

---

## 12. Game rules engine and fair play (server-authoritative)

**Start** `POST /rounds/{key}/attempts`: resume any active attempt; round must be unlocked; chances < 3 else 409 (unique constraint is the backstop); choose a page the player has not used (stable hash of email + round + chance spreads players), else least-used; `startedAt` = server now, `deadlineAt` = + limit; the chance is used from this moment; pre-fill answers (परख empty; main rounds = drafts, `done: false`).

**Autosave** `PUT /attempts/{id}/autosave {version, clientId, answers}`: 2 s after typing stops, every 10 s, and on `pagehide` via `sendBeacon`; mirrored in IndexedDB and flushed on reconnect. Reject stale versions and anything after deadline + 30 s grace; re-insert removed locked tokens.

**One live window [§15]:** the latest `clientId` to open the attempt takes over; an older tab becomes read-only with "यह राउंड किसी दूसरी विंडो में खुला है।"

**Submit / auto-submit:** client submits at zero; a server job every 30 s submits any attempt past deadline + grace from its last autosave (`autoSubmitted`, time fraction 1). Early submit with parts open: first press → "पक्का जमा करें?" and "अभी n हिस्से बाकी हैं"; second press within 4 s submits.

**Freeze screen** from शुरू करें to submit:
- Fullscreen API where supported (desktop, iPad). iPhone Safari has no element fullscreen: use the focus layout and rely on visibility tracking.
- Block in editor and source: `paste`, `copy`, `cut`, `drop`, `dragstart`, `contextmenu`, `beforeinput` (`insertFromPaste`, `insertFromDrop`, `insertFromYank`), Ctrl/Cmd + C/V/X. Friendly toast, `copy_paste_blocked` line, count. A single input event inserting > 40 characters not from the helper, glossary or ASR is treated as a paste and reverted.
- Leaving: `visibilitychange` hidden, desktop window `blur`, fullscreen exit → one count per departure (2 s debounce), event to server, warning card on return; count on the report card.
- Locked numbers: TipTap atom node `lockedToken`; a transaction filter rejects deleting or changing it.

**Round order and credits** as in §1 and §11. Round results are computed, never stored. Title when best ≥ 33.

---

## 13. Certificate

`GET /me/certificate?format=pdf|png`, rendered by Playwright from an HTML template, A4 landscape, Noto Sans Devanagari: CAG logo left, BHASHINI logo right, "हिंदी शराड्स", "प्रमाणित किया जाता है कि", player name and office, titles earned (only rounds with best ≥ 33, in round order), total credits / 50, date, verification ID (hash), signatory placeholder until CAG supplies the template.

---

## 14. API surface

Session: httpOnly, Secure, SameSite=Lax cookie (JWT, 12 h). Zod on every body. Rate limits: OTP 5/hour/email; chat 20/attempt; xlit 20/s/player.

| Group | Endpoints |
|---|---|
| Auth | `POST /auth/otp/request`, `POST /auth/otp/verify`, `POST /players/register`, `POST /auth/logout`, `GET /offices?q=` |
| Content | `GET /config`, `GET /rounds`, `GET /content/strings`, `GET /sahayika/lines?section=`, `GET /glossary?q=`, `GET /me/progress` |
| Play | `POST /rounds/{key}/attempts`, `GET /attempts/{id}` (no `hiReference`, `sector`, slip fixes), `PUT /attempts/{id}/autosave`, `POST /attempts/{id}/events`, `POST /attempts/{id}/submit`, `GET /attempts/{id}/report`, `GET /attempts/{id}/review` (player's own text + flags) |
| Results | `GET /me/summary`, `GET /me/certificate?format=` |
| Language services | `GET /xlit?word=`, `WS /speech/asr/stream`, `POST /speech/asr`, `GET /sahayika/audio/{lineId}`, `POST /sahayika/tts`, `POST /sahayika/chat` |
| Manager | `GET/POST /admin/pages`, `PUT /admin/pages/{id}`, `POST /admin/pages/{id}/ocr`, `POST /admin/pages/{id}/draft`, `PUT /admin/pages/{id}/slips`, `POST /admin/pages/{id}/publish`, `POST /admin/glossary/import`, `PUT /admin/glossary/{id}`, `POST /admin/offices/import`, `POST /admin/offices/translate-names`, `PUT /admin/config/credits`, `POST /admin/sahayika/audio`, `PUT /admin/sahayika/lines/{id}`, `GET /admin/chatlog`, `GET /admin/results`, `GET /admin/exports/credits` |

The client must never receive `hiReference`, `sector`, planted-slip fixes, other players' data or any key (contract test).

---

## 15. Experience improvements built into this version

These go beyond the Concept Note; each is small and is marked [§15] where specified above.

1. **Mic check before the clock** (परख pop-up), so a permission dialog never eats into the 20 minutes.
2. **Transliteration helper** with undo (Backspace), `.` → `।`, keep-as-typed option, and a mobile suggestion strip.
3. **Linked focus** between each Hindi part and its English part, so long pages stay easy to follow.
4. **Autosave status** in the header, so officers trust that refreshes are safe.
5. **One live window:** a second tab cannot overwrite the first.
6. **Review own answer** after the report card, with flagged words underlined, for learning without exposing the reference.
7. **Planted-slip register** in the console, so Sahayika's hints and draft highlights point at real, page-specific issues.
8. **Accessible colours:** small text uses `#C2410C` and `#6B7280` (the designs' `#E8590C` and `#93989E` fail contrast for small text); orange buttons use ≥ 18 px bold labels.
9. **Audio etiquette:** Sahayika auto-speaks only after the first tap and has a remembered mute switch.
10. **Timer clarity:** `mm:ss` below 1 hr, `h:mm:ss` above; announced to screen readers at 5 and 1 minutes.
11. **Light pages:** subset WOFF2 fonts, round payload under 300 KB, works on modest office connections.
12. **Neutral typing label:** "रोमन से हिंदी" replaces "गूगल इनपुट" in the designs, since suggestions come from BHASHINI.

---

## 16. Security and privacy

Keys only in server env; `.env.example` lists names, never values; rotate any key that has been in a client bundle. Personal data only in the India-hosted database; privacy note at registration; exports limited to managers; every admin action audited. Do not import office-admin contacts. CSP `default-src 'self'`; fonts and scripts self-hosted. HTTPS with HSTS.

---

## 17. Build plan to 27 October

| Milestone | Deliverable | Done when |
|---|---|---|
| M0 · D1 | Monorepo, Compose, HTTPS, Prisma, config + strings + script loaders, seed (offices, glossary + overrides, script, trial page), forbidden-words CI | Title screen served over HTTPS; seed loads |
| M1 · D1 | `packages/shared` rules and scoring with §11 tests | Tests pass |
| M2 · D2 | OTP auth, registration, how-to-play, rules, returning-player resume | e2e new + returning flows pass |
| M3 · D2–3 | Attempts, timer, autosave, auto-submit, one live window, freeze screen, TipTap editor with locked tokens, InScript, glossary drawer | Refresh keeps text and clock; 4th attempt refused; paste blocked |
| M4 · D3 | Transliteration helper (§9.2) + proxy; ASR relay + fallback; batch NMT; TTS | Helper works on desktop and phone; voice only in परख |
| M5 · D3–4 | Report card, review view, total score, credits, stars, tips, certificate | Worked examples match; certificate shapes Devanagari correctly |
| M6 · D4 | Sahayika: all 194 lines wired to triggers, audio, hint engine, chat with guards | "Translate paragraph 2 for me" is refused kindly |
| M7 · D4–5 | Console: ingest wizard incl. OCR, pairing, draft, planted slips, terms, publish; glossary; offices; results export | A manager publishes a new page from the Report 38 PDFs |
| M8 · D5 | Cross-device pass, accessibility pass, RUNBOOK | §18 all green |

---

## 18. Ready-for-review checklist

1. No old name, no Guru, no archery image anywhere (CI scan).
2. New player registers; returning player resumes with credits intact.
3. Four rounds in order with exact names, titles, times and credit caps.
4. परख: voice + keyboard, no draft. Other rounds: BHASHINI draft, keyboard only, numbers locked.
5. Transliteration suggestions appear only in the translation editor; Space picks the first; Esc keeps Roman; works on phone.
6. Copy/cut/paste/right-click blocked; leaving warned and counted; timer survives refresh; time-out auto-submits.
7. Report card: five measures as counts, score / 100, chances with best ★, one tip, title only at ≥ 33.
8. 4th attempt refused; credits from best score to 1 decimal; total never above 50.
9. Sahayika: every line in Hindi with 🔊 सुनें speaking English (female); chat follows §10.4.
10. Certificate lists only titles earned.
11. Works on Windows (Chrome, Edge), macOS (Safari), iPhone and iPad (Safari).
12. No `hiReference`, `sector`, slip fixes or keys in any client response.

---

## 19. Seed and reference files

| File | Contents | Status |
|---|---|---|
| `seed/offices.json` | 231 offices (English names, composed addresses where missing) | Ready; Hindi names pending (D8) |
| `seed/glossary.json` | 11,390 terms with accepted variants, avoid forms, flags | Ready |
| `seed/glossary_overrides.json` | Annexure, Appendix, Report | Pending CAG confirmation (D3) |
| `seed/pages/trial_r38_page_v.json` | परख passage, 16 sentences / 357 words, reference Hindi, locked numbers, 12 terms | Needs manager verification before publishing |
| `content/sahayika.script.json` | 194 lines, knowledge, FAQ, chatbot rules, renamed | Ready; Hindi lines authored by the project team |
| `content/strings.hi.json` | All UI strings; keys listed in `_authoredInSpec_reviewBeforeLaunch` need review | Ready |
| `reference/screen-designs/01…14_*.jpg` | The 14 screen designs | Reference |
| `reference/sample-report/` | Report 38 of 2025, English + Hindi | For ingestion testing |

Each round needs **at least 3 published pages** for the review build. Until real pages are verified, the dev seeder may clone the trial passage across chances and label the UI "sample content" (`SEED_ALLOW_UNVERIFIED=1`, development only).
