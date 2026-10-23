import { numberTokens } from "@hc/shared";

interface Line { text: string; y: number; size: number; bold: boolean }

/**
 * Ingest step b (§8.3): split one English PDF page into typed parts from its text layer.
 * Heuristics only — the manager splits, merges, retypes and reorders afterwards.
 */
export async function segmentPdfPage(data: Uint8Array, pageNo: number) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  if (pageNo < 1 || pageNo > doc.numPages) throw Object.assign(new Error("page_out_of_range"), { statusCode: 400 });
  const page = await doc.getPage(pageNo);
  const vp = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  // group text items into lines by baseline
  const rows = new Map<number, { x: number; str: string; size: number; font: string }[]>();
  for (const it of content.items as any[]) {
    if (!it.str?.trim()) continue;
    const y = Math.round(vp.height - it.transform[5]);
    const key = [...rows.keys()].find((k) => Math.abs(k - y) <= 2) ?? y;
    rows.set(key, [...(rows.get(key) ?? []), { x: it.transform[4], str: it.str, size: Math.abs(it.transform[0]), font: it.fontName ?? "" }]);
  }
  const fonts = (content as any).styles ?? {};
  const lines: Line[] = [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([y, items]) => {
    items.sort((a, b) => a.x - b.x);
    const size = Math.max(...items.map((i) => i.size));
    const bold = items.some((i) => /bold/i.test(fonts[i.font]?.fontFamily ?? i.font));
    return { text: items.map((i) => i.str).join(" ").replace(/\s+/g, " ").trim(), y, size, bold };
  });
  const sizes = lines.map((l) => l.size).sort((a, b) => a - b);
  const body = sizes[Math.floor(sizes.length / 2)] ?? 11;
  type P = { type: string; en: string };
  const parts: P[] = [];
  const push = (type: string, text: string) => {
    const last = parts[parts.length - 1];
    if (last && last.type === type && type === "body_cont") last.en += " " + text;
    else parts.push({ type, en: text });
  };
  lines.forEach((l, i) => {
    const prev = lines[i - 1];
    const gap = prev ? l.y - prev.y : 0;
    const top = l.y < vp.height * 0.08, bottom = l.y > vp.height * 0.9;
    if (/^\d{1,3}$|^[ivxl]+$/i.test(l.text) && (bottom || top)) return push("page_number", l.text);
    if (top) return push("header", l.text);
    if (l.size < body - 1 && /^\d{1,3}\s/.test(l.text)) return push("footnote", l.text);
    if (bottom) return push("footer", l.text);
    if (l.size > body + 0.8 || (l.bold && l.text.length < 120)) return push("heading", l.text);
    if (prev && parts.length && parts[parts.length - 1].type.startsWith("body") && gap < body * 1.9) {
      parts[parts.length - 1].en += " " + l.text;
      return;
    }
    if (parts.length && parts[parts.length - 1].type === "footnote" && l.size < body - 1) {
      parts[parts.length - 1].en += " " + l.text;
      return;
    }
    push("body", l.text);
  });
  return {
    numPages: doc.numPages,
    parts: parts.map((p, i) => ({
      part_id: `p${String(i + 1).padStart(2, "0")}`,
      type: p.type,
      tick_group: p.type === "page_number" ? null : `g${String(i + 1).padStart(2, "0")}`,
      en: p.en.replace(/-\s+(?=[a-z])/g, ""),
      hi_reference: "",
      bhashini_draft: null,
      locked_tokens: numberTokens(p.en),
      editable: p.type !== "page_number",
    })),
  };
}
