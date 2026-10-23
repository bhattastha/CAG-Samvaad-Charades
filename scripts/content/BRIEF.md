# Brief: build parallel English–Hindi page files for Samvaad Charades

You are producing scoring references for a CAG Hindi translation game. Players see an English audit-report
page and a machine Hindi draft; their edits are scored (chrF) against **CAG's own published Hindi** of the
same page. Your job: for each assigned English page, write a clean structured JSON with every English part
and the **exact published Hindi** for it, read from the Hindi PDF page images.

Working dir: `scripts/content/` (inside the repo `hindi-charades-kit`). Python with PyMuPDF:
`/private/tmp/claude-501/-Users-asthabhatt-Desktop-CAG-Hindi-Charades/dd4a4e48-dbc5-4f69-ba17-901661383ffc/scratchpad/pdfenv/bin/python`

## Inputs
- `work/img/en/en_<pdf>.png` — English page image (144 dpi; PDF points = pixels / 2). View it with the Read tool.
- `work/<bundle>/en_<pdf>.json` — automatic skeleton (rough: bold paragraphs often mis-typed as headings,
  wrapped lines split, chart axis numbers leaking in as parts, tables sometimes garbled). Use it as a start, not as truth.
- `python dump_text.py en <pdf>` — exact English text layer (use this for exact English wording and numbers).
- `work/img/hi/hi_<pdf>.png` — Hindi page images (170 dpi). **Read the Hindi from these images.**
- `python dump_text.py hi <pdf>` — Hindi text layer. Its letters are BROKEN (e.g. अध्र्ार् for अध्याय, ककया for
  किया). Use it ONLY to confirm digits/numbers, never copy its words.
- `work/hindi_index.json` — section numbers found on each Hindi PDF page. The Hindi edition is longer, so one
  English page usually maps to 1–2 Hindi pages; locate by section numbers (2.3.1), Table n ↔ तालिका n,
  Chart n ↔ चार्ट n, footnote numbers and number sequences. Your assignment gives a suggested Hindi range; verify it.
- `python crop.py <pdf> x0,y0,x1,y1 work/<bundle>/fig_<pdf>_<n>.png` — re-crop a chart/figure if the skeleton crop is wrong.

## Output: `work/<bundle>/page_<pdf>.json` (one per assigned page)
```json
{ "pdf_page": 20, "printed_page": "2", "hindi_pdf_pages": [24, 25],
  "parts": [
    {"type": "header", "en": "Report No. 38 of 2025", "hi_reference": "2025 की प्रतिवेदन संख्या 38"},
    {"type": "heading", "en": "1.3 Production Performance", "hi_reference": "1.3 उत्पादन निष्पादन"},
    {"type": "body", "en": "<one full paragraph or one bullet>", "hi_reference": "<its Hindi>"},
    {"type": "table", "layout": {
        "title": {"en": "Table 1: Financial Performance of SAIL", "hi_reference": "तालिका 1: ..."},
        "unit":  {"en": "(Amount: ₹ in crore)", "hi_reference": "(राशि: ₹ करोड़ में)"},
        "columns": [{"en": "Year", "hi_reference": "वर्ष"}, {"en": "Turnover", "hi_reference": "..."}],
        "rows": [[{"en": "2017-18"}, {"en": "58,297"}], [{"en": "Total", "hi_reference": "कुल"}, {"en": "1,02,805"}]],
        "note": {"en": "Source: Data furnished by Management.", "hi_reference": "स्रोत: प्रबंधन द्वारा प्रस्तुत आंकड़े।"}}},
    {"type": "figure", "layout": {"image": "fig_20_1.png",
        "title":  {"en": "Chart-1: ...", "hi_reference": "चार्ट-1: ..."},
        "labels": [{"en": "Hot Metal", "hi_reference": "तप्त धातु"}],
        "source": {"en": "Source: ...", "hi_reference": "स्रोत: ..."}}},
    {"type": "footnote", "en": "16 Quantity of coke consumed ...", "hi_reference": "16 ..."},
    {"type": "page_number", "en": "2"}
  ] }
```
Rules:
1. **Types:** `header` (running line "Report No. 38 of 2025"), `heading` (section/sub-section titles, incl. bold
   side headings), `headnote` (boxed summary/recommendation boxes), `body` (one paragraph or one bullet; join
   wrapped lines into one string), `footnote`, `table`, `figure`, `page_number`. Order = reading order, footnotes last
   before page_number. Drop the margin chapter tab (I, II…), chart axis tick numbers, and chapter divider graphics.
2. **English text must be exact** (from the text layer), with wrapped lines joined and hyphenation fixed. Footnote
   markers in running text: keep the number glued as in the PDF text, or write it as a superscript (¹⁶).
3. **Hindi must be CAG's published Hindi, transcribed faithfully from the image** — same words, same order,
   Unicode Devanagari, `।` as full stop, numbers exactly as in English (Hindi edition uses the same digits). Do
   NOT translate yourself and do NOT "improve" CAG's Hindi. If a Hindi sentence spills onto the next Hindi page,
   include it. If the Hindi paragraph boundaries differ, split the Hindi to match the English parts as closely as
   the meaning allows.
4. If an English part truly has no Hindi counterpart (rare), set `"hi_reference": ""` and add `"missing": true`.
   If the image is unreadable for a word, give your best reading and add `"uncertain": true` on that part.
5. **Tables:** keep the grid. Number-only cells: `{"en": "58,297"}` only. Word cells need `hi_reference`. Merged/
   multi-line header cells → one cell each, same column count per row (pad with `{"en": ""}`). If a table is a
   layout box rather than data (e.g. a "Recommendation" box), make it `headnote`/`body` parts instead.
6. **Figures (charts, diagrams, photos):** keep `image` (re-crop if the crop misses the figure or includes body
   text; crops must not include the caption paragraph text you already captured). `labels` = legend entries and
   word labels inside the figure that a translator would translate (not numbers). Title and source as their own fields.
7. Skip nothing else: every English sentence on the page must appear in some part.
8. Work page by page; write each file as soon as it is done. Don't touch any other files in the repo.

When finished, reply with: pages written, any parts flagged missing/uncertain, and anything odd.
