# Glossary matching — algorithm reference

How Anuvaad finds glossary terms in a document and offers their approved translations.
Written so the approach can be reimplemented elsewhere; the Anuvaad implementation is
`GlossaryService.match_document` in `service/glossary_service.py`.

The problem it solves: a translator opens a document and needs to know which phrases in it
have organisation-approved translations, which of several approved variants is preferred, and
which apply to this document's subject area rather than generally.

---

## Inputs and output

**In:** a batch identifier, which resolves to a document and from there to an organisation, a
source and target language, and a department.

**Out:** a list of items, one per (detected phrase × applicable glossary entry):

```
source_term     the term as stored in the glossary
target_term     every approved translation, ranked best-first
target_weights  usage count per translation
sector          the subject area this entry belongs to, or null for a general entry
```

The same detected phrase may produce two items — one sector-specific, one general. The caller
groups by `source_term` and shows `sector` as a sub-heading.

---

## Phase 1 — Resolve the scope

1. Resolve batch → document. Read `org_type`, `source_language`, `target_language`,
   `department`.
2. `sector = department`, **but only if that department is one of the organisation's declared
   sectors**; otherwise null. An arbitrary department string must never become a sector, or
   entries get filed under values nothing will ever match again.
3. Find the glossary for (`org_type`, `source_language`, `target_language`). No glossary → no
   matches. One glossary per language pair per organisation.

## Phase 2 — Load the vocabulary

4. Load every entry where `glossary_id` matches, `status = APPROVED`, and:

   ```
   sector ∈ { this document's sector, null }      when a sector was resolved
   sector = null                                   when it was not
   ```

   **Sector scoping is additive, not exclusive.** A Railways document sees Railways terms *and*
   general terms. Only approved entries participate; drafts and rejections are invisible here.

5. Build **two** indexes, both keyed on the normalised source term:

   | Index | Value | Used for |
   |---|---|---|
   | `term_map` | **one** entry per key | detecting phrases in the text |
   | `entries_by_term` | **all** entries per key | building the output |

   The split matters. Detection only asks "is this phrase a glossary term?", so one entry per
   key is enough and a hash lookup answers it. Output must emit every entry sharing that term
   — the Railways one *and* the general one — so it needs the full list. Collapsing them for
   detection costs nothing because which duplicate wins never reaches the output.

## Phase 3 — Get the text

6. Download the batch's **source-language** document. Matching runs on the source, never on a
   translation.
7. Extract text from every part a term can hide in:
   - body paragraphs
   - tables, **recursing into nested tables inside cells**
   - every section's header and footer, including tables within them

   Join with spaces. Skip empty paragraphs. A term in a table header is as real as one in a
   sentence, and documents of this kind carry a great deal of their vocabulary in tables.

## Phase 4 — Normalise

8. One function, applied to **both** the glossary's source terms and the document text:

   ```
   normalise(text):
       lowercase
       replace every character that is not a word character or whitespace with a space
       collapse runs of whitespace to one space
       trim
   ```

   This is the load-bearing invariant of the whole design: **both sides must pass through the
   same normaliser**, or the hash lookup in Phase 5 silently finds nothing. Punctuation becomes
   a separator rather than being deleted, so `F.E.-R.A.` normalises to `f e r a` — four tokens,
   matched only if the stored term normalises identically.

   Use a Unicode-aware word-character class, so Devanagari and other Indic scripts survive
   normalisation and the same code works when the source language is not English.

## Phase 5 — N-gram matching, longest first, without overlap

9. Split the normalised text into tokens on whitespace.
10. Walk phrase lengths from longest to shortest:

```
MAX_PHRASE = 6
claimed = empty set of token positions
matches = []

for size from min(MAX_PHRASE, token_count) down to 1:
    for i from 0 to token_count - size:
        if any position in [i, i+size) is in claimed:
            continue
        phrase = tokens[i .. i+size-1] joined with a single space
        if phrase in term_map:
            matches.append(term_map[phrase])
            claim positions [i, i+size)
```

Two properties fall out of this, and both are deliberate:

**Longest match wins.** `foreign exchange regulation act` is tried before `foreign exchange`,
which is tried before `exchange`. The most specific approved term is the one offered.

**No token is matched twice.** Once `foreign exchange` claims its positions, `exchange` cannot
also match there. Without this the translator is shown overlapping, contradictory suggestions
for the same words.

`MAX_PHRASE = 6` bounds the work. Raise it only if the glossary genuinely holds longer terms;
the cost is linear in it.

## Phase 6 — Rank the translations

11. Each entry carries `target_term` (a list) and `target_weights` (a map of translation →
    usage count). Sort the list by weight descending, absent weights counting as zero.

    Weights **rank** variants; they never **filter** them. Every approved translation stays
    visible — the ordering only expresses which one colleagues have been choosing. A variant at
    weight zero is a legitimate choice that happens not to have been picked yet.

## Phase 7 — Deduplicate and emit

12. A term appearing forty times in a document should be offered once. Keep the first
    occurrence per normalised phrase, discard the rest.
13. For each surviving phrase, emit one item **per entry** holding that source term, ordered
    **sector-specific before general**, so the subject-area translation is presented first.

---

## Cost

| | |
|---|---|
| Index building | O(E) for E approved entries in scope |
| Matching | O(MAX_PHRASE × N) hash lookups for N tokens — 6 passes over the token list |
| Memory | the whole in-scope glossary resident during the call |

The matching itself is cheap. **The expensive part is loading the glossary**, which in the
Anuvaad implementation happens on every call with no caching — measured at a p95 of 9.65
seconds under concurrent load for ~11,700 entries. Anyone reimplementing this should cache the
built indexes per (glossary, sector) and invalidate on entry changes. It is the single highest-
value optimisation available and it is not in the current code.

## Design decisions worth keeping

**Exact match after normalisation, not fuzzy matching.** A glossary is a statement about
approved wording. Fuzzy matching would offer the approved translation of a term the document
does not actually contain, which is worse than offering nothing.

**Same normaliser on both sides.** The one rule that cannot be bent. Any divergence produces
silent failure, not an error.

**Sector widens, never narrows.** General terms remain available inside a specialist document.

**Weights order, never exclude.** Usage expresses preference, not authority.

**Detection and presentation use different indexes.** Collapsing duplicates for the lookup
keeps detection a single hash probe; keeping them for the output preserves the sector
distinction the reader needs.

## Characteristics to be aware of

- **Punctuation becomes whitespace.** Hyphenated and abbreviated terms split into multiple
  tokens and only match if the stored term splits the same way. Normalise entries on the way in
  and store the normalised form alongside the display form if this matters to you.
- **The glossary is read fresh on every call.** See *Cost* above.
- **Matching is on the source document only.** The translated text is never inspected.
- **Only the first occurrence of a term is reported.** Position information is discarded, so
  this design cannot support in-place highlighting without extending Phase 7 to retain the
  token offsets the matcher already computes.
