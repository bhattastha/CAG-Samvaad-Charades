"""Segment English report pages into typed parts (header, heading, body, footnote, table, figure, page_number).

Usage: python segment_en.py <english.pdf> <out_dir> <bundle_key> <pdf_page>[,<pdf_page>...]
Writes <out_dir>/<bundle_key>/en_<pdf_page>.json and figure crops <out_dir>/<bundle_key>/fig_<pdf_page>_<n>.png.
Requires PyMuPDF. Output is a skeleton: hi_reference is left empty for transcription.
"""
import json
import os
import re
import sys

import fitz

SEC = re.compile(r"^(\d+(\.\d+){1,4})\s*$")
CAPTION = re.compile(r"^(Table|Chart|Figure|Graph|Picture)\s*[-–]?\s*\d+", re.I)
BULLET = re.compile(r"^[•▪●\-–]\s*")


def lines_of(page):
    d = page.get_text("dict")
    out = []
    for b in d["blocks"]:
        if b["type"] != 0:
            continue
        for l in b["lines"]:
            text = "".join(s["text"] for s in l["spans"])
            if not text.strip():
                continue
            s = max(l["spans"], key=lambda s: len(s["text"].strip()))
            out.append({
                "text": text.strip(),
                "bbox": l["bbox"],
                "size": round(s["size"], 1),
                "bold": "Bold" in s["font"],
                "italic": "Italic" in s["font"] or "It" in s["font"].split("-")[-1],
                "origin_y": l["bbox"][1],
            })
    return out


def inside(bb, region, pad=2):
    return bb[0] >= region[0] - pad and bb[1] >= region[1] - pad and bb[2] <= region[2] + pad and bb[3] <= region[3] + pad


def merge_rows(lines, tol=3):
    """Join lines sharing a baseline (section number + heading text, etc.)."""
    lines = sorted(lines, key=lambda l: (round(l["bbox"][1] / tol), l["bbox"][0]))
    rows = []
    for l in lines:
        if rows and abs(rows[-1]["bbox"][1] - l["bbox"][1]) <= tol and l["bbox"][0] > rows[-1]["bbox"][0]:
            r = rows[-1]
            r["text"] = (r["text"] + " " + l["text"]).strip()
            r["bbox"] = (r["bbox"][0], min(r["bbox"][1], l["bbox"][1]), max(r["bbox"][2], l["bbox"][2]), max(r["bbox"][3], l["bbox"][3]))
            r["bold"] = r["bold"] and l["bold"]
        else:
            rows.append(dict(l))
    return rows


def figure_regions(page, captions):
    """Regions of images and dense vector drawings, each paired with the nearest caption."""
    regions = []
    for info in page.get_image_info():
        bb = info["bbox"]
        if (bb[2] - bb[0]) * (bb[3] - bb[1]) > 4000:
            regions.append(fitz.Rect(bb))
    draws = [fitz.Rect(d["rect"]) for d in page.get_drawings() if d["rect"].width < 520]
    # cluster drawings
    clusters = []
    for r in draws:
        for c in clusters:
            if c.intersects(r + (-6, -6, 6, 6)):
                c |= r
                break
        else:
            clusters.append(fitz.Rect(r))
    changed = True
    while changed:
        changed = False
        for i in range(len(clusters)):
            for j in range(i + 1, len(clusters)):
                if clusters[i].intersects(clusters[j] + (-6, -6, 6, 6)):
                    clusters[i] |= clusters[j]
                    clusters.pop(j)
                    changed = True
                    break
            if changed:
                break
    regions += [c for c in clusters if c.width > 150 and c.height > 80]
    # merge overlapping regions
    merged = []
    for r in regions:
        for m in merged:
            if m.intersects(r):
                m |= r
                break
        else:
            merged.append(fitz.Rect(r))
    return merged


def run(pdf, out_dir, key, pages):
    doc = fitz.open(pdf)
    os.makedirs(os.path.join(out_dir, key), exist_ok=True)
    for pno in pages:
        page = doc[pno - 1]
        H = page.rect.height
        raw = lines_of(page)
        tables = [t for t in page.find_tables().tables if t.row_count >= 2 and t.col_count >= 2]
        tregions = [fitz.Rect(t.bbox) for t in tables]
        caps = [l for l in raw if CAPTION.match(l["text"])]
        fregions = [r for r in figure_regions(page, caps) if not any(r.intersects(t) and abs(r & t) > 0.5 * abs(r) for t in tregions)]

        parts = []
        used = set()
        printed = None
        # header / page number
        for i, l in enumerate(raw):
            y = l["bbox"][1]
            if y < 60 and l["italic"] and "Report No" in l["text"]:
                parts.append({"type": "header", "en": l["text"], "y": y})
                used.add(i)
            elif (y < 60 or y > H - 70) and re.fullmatch(r"[0-9ivxlc]+", l["text"]):
                printed = l["text"]
                used.add(i)
            elif re.fullmatch(r"(I|II|III|IV|V|VI|VII)", l["text"]) and l["bbox"][0] > page.rect.width - 60:
                used.add(i)  # chapter tab on the margin

        # tables
        for ti, t in enumerate(tables):
            data = t.extract()
            tr = fitz.Rect(t.bbox)
            for i, l in enumerate(raw):
                if inside(l["bbox"], tr):
                    used.add(i)
            title = next((l for i, l in enumerate(raw) if i not in used and l["text"].lower().startswith("table") and 0 <= tr.y0 - l["bbox"][3] < 40), None)
            unit = next((l for i, l in enumerate(raw) if i not in used and l["text"].startswith("(") and 0 <= tr.y0 - l["bbox"][3] < 25 and "crore" in l["text"].lower() or (l["text"].startswith("(") and "in " in l["text"] and 0 <= tr.y0 - l["bbox"][3] < 25)), None)
            src = next((l for i, l in enumerate(raw) if i not in used and l["text"].lower().startswith("source") and 0 <= l["bbox"][1] - tr.y1 < 30), None)
            for x in (title, unit, src):
                if x:
                    used.add(raw.index(x))
            clean = lambda c: re.sub(r"\s+", " ", (c or "")).strip()
            rows = [[clean(c) for c in r] for r in data]
            parts.append({
                "type": "table", "y": title["bbox"][1] if title else tr.y0,
                "layout": {
                    "title": {"en": title["text"]} if title else None,
                    "unit": {"en": unit["text"]} if unit else None,
                    "columns": [{"en": c} for c in rows[0]],
                    "rows": [[{"en": c} for c in r] for r in rows[1:]],
                    "note": {"en": src["text"]} if src else None,
                },
            })

        # figures
        for fi, fr in enumerate(fregions):
            cap = None
            for i, l in enumerate(raw):
                if i in used:
                    continue
                if CAPTION.match(l["text"]) and (0 <= fr.y0 - l["bbox"][3] < 45 or 0 <= l["bbox"][1] - fr.y1 < 30):
                    cap = (i, l)
                    break
            src = None
            for i, l in enumerate(raw):
                if i not in used and l["text"].lower().startswith("source") and 0 <= l["bbox"][1] - fr.y1 < 40:
                    src = (i, l)
                    break
            labels = []
            for i, l in enumerate(raw):
                if i in used:
                    continue
                if inside(l["bbox"], fr, 4):
                    used.add(i)
                    if re.search(r"[A-Za-z]{2,}", l["text"]):
                        labels.append(l["text"])
            for x in (cap, src):
                if x:
                    used.add(x[0])
            img = f"fig_{pno}_{fi + 1}.png"
            clip = fr + (-4, -4, 4, 4)
            page.get_pixmap(clip=clip, dpi=144).save(os.path.join(out_dir, key, img))
            parts.append({
                "type": "figure", "y": cap[1]["bbox"][1] if cap and cap[1]["bbox"][1] < fr.y0 else fr.y0,
                "layout": {
                    "image": img, "width": round(clip.width), "height": round(clip.height),
                    "title": {"en": cap[1]["text"]} if cap else None,
                    "labels": [{"en": x} for x in dict.fromkeys(labels)],
                    "source": {"en": src[1]["text"]} if src else None,
                },
            })

        # remaining text → headings, body paragraphs, footnotes
        rest = [l for i, l in enumerate(raw) if i not in used]
        rows = merge_rows(rest)
        body_rows = [r for r in rows if r["size"] >= 11]
        last_body_y = max((r["bbox"][3] for r in body_rows), default=0)
        cur = None
        prev = None
        for r in rows:
            t = r["text"]
            y = r["bbox"][1]
            is_foot = r["size"] < 11 and y >= last_body_y - 2
            if is_foot:
                m = re.match(r"^(\d{1,3})\s+(.*)", t)
                if m or cur is None or cur["type"] != "footnote":
                    cur = {"type": "footnote", "en": t, "y": y}
                    parts.append(cur)
                else:
                    cur["en"] += " " + t
                prev = r
                continue
            heading = r["bold"] and (re.match(r"^\d+(\.\d+)+\s", t) or len(t) < 90) and not t.endswith(".") or (re.match(r"^\d+(\.\d+)+\s+[A-Z]", t) and r["bold"])
            if heading and not BULLET.match(t) and not t.lower().startswith("recommendation"):
                cur = {"type": "heading", "en": t, "y": y}
                parts.append(cur)
                prev = r
                cur = None
                continue
            gap = (y - prev["bbox"][3]) if prev else 99
            new_para = cur is None or gap > 6 or BULLET.match(t) or (prev and prev["bold"] != r["bold"] and r["bold"])
            if new_para:
                cur = {"type": "body", "en": t, "y": y}
                parts.append(cur)
            else:
                joiner = "" if cur["en"].endswith("-") else " "
                cur["en"] = cur["en"] + joiner + t
            prev = r

        parts.sort(key=lambda p: (p["type"] == "footnote", p["y"]))
        for p in parts:
            p.pop("y", None)
            if "en" in p:
                p["en"] = re.sub(r"\s+", " ", p["en"]).strip()
        parts.append({"type": "page_number", "en": printed or ""})
        out = {"pdf_page": pno, "printed_page": printed, "parts": parts}
        with open(os.path.join(out_dir, key, f"en_{pno}.json"), "w") as f:
            json.dump(out, f, ensure_ascii=False, indent=1)
        print(key, pno, printed, len(parts), "parts", sum(p["type"] == "table" for p in parts), "tables", sum(p["type"] == "figure" for p in parts), "figures")


if __name__ == "__main__":
    pdf, out_dir, key, pages = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
    run(pdf, out_dir, key, [int(x) for x in pages.split(",")])
