import { useMemo } from "react";
import type { Answers, ClientPart } from "@hc/shared";
import { t } from "../lib/strings";
import { Icon } from "../components/Icon";
import { PartEditorBody, PartSource, TickButton, type DraftProps } from "./PageViews";
import type { SourceTerm } from "./useAttempt";

/**
 * Translation workbench in the CAG Anuvaad layout: one row per segment (English source | Hindi target),
 * the focused segment highlighted, and a context panel beside it with that segment's glossary and QA checks.
 */
export function SegmentRows({ parts, allParts, terms, onTerm, focusedPart, onSelect, d }: {
  parts: ClientPart[];
  allParts: ClientPart[];
  terms: Record<string, Record<string, SourceTerm[]>>;
  onTerm(partId: string, fieldKey: string, term: SourceTerm, rect: DOMRect): void;
  focusedPart: string | null;
  onSelect(partId: string): void;
  d: DraftProps;
}) {
  const number = useMemo(() => new Map(allParts.filter((p) => p.editable).map((p, i) => [p.id, i + 1])), [allParts]);
  return (
    <div className="divide-y divide-slate-100" translate="no">
      {parts.map((p) => {
        if (!p.editable) return <div key={p.id} className="px-4 py-1.5 text-right text-[12px] text-muted en">{t("round.pageNumberLabel")} {p.fields[0]?.en}</div>;
        const done = !!d.answers[p.id]?.done;
        const on = focusedPart === p.id;
        const wide = p.type === "table" || p.type === "figure" || p.type === "chart";
        const issues = qaFor(p, d.answers, d.watch).filter((q) => !q.ok).length;
        const head = (
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
            <span className={`tnum rounded px-1.5 py-0.5 ${on ? "bg-navy text-white" : "bg-slate-100 text-navy"}`}>#{number.get(p.id)}</span>
            <span>{t(`round.partTypes.${p.type}`)}</span>
            {issues > 0 && !done && <span className="inline-flex items-center gap-1 normal-case tracking-normal text-primary-strong"><Icon name="alert" size={12} />{t("round.qaIssues", { n: issues })}</span>}
          </div>
        );
        const tick = !d.readOnly && <TickButton done={done} disabled={false} onClick={() => d.onTick(p.id, !done)} />;
        return (
          <div key={p.id} data-dst={p.id} data-src={p.id} onFocusCapture={() => onSelect(p.id)} onClick={() => onSelect(p.id)}
            className={`relative transition-colors ${on ? "bg-navy-50/70" : done ? "bg-success-soft/25" : "bg-white hover:bg-slate-50/60"}`}>
            <span className={`absolute left-0 inset-y-0 w-[3px] ${on ? "bg-primary" : done ? "bg-success" : "bg-transparent"}`} aria-hidden />
            {wide ? (
              <div className="px-4 py-3 space-y-3">
                <div className="flex items-center justify-between gap-2">{head}{tick}</div>
                <div className="no-select en text-[15px] leading-[1.65] text-navy" onCopy={(e) => e.preventDefault()}><PartSource p={p} terms={terms} onTerm={onTerm} /></div>
                <div className="rounded-md border border-dashed border-slate-300 p-2.5 bg-white"><PartEditorBody p={p} d={d} /></div>
              </div>
            ) : (
              <div className="grid md:grid-cols-2">
                <div className="px-4 py-3 md:border-r border-slate-100">
                  {head}
                  <div className="mt-1.5 no-select en text-[15px] leading-[1.65] text-navy" onCopy={(e) => e.preventDefault()}><PartSource p={p} terms={terms} onTerm={onTerm} /></div>
                </div>
                <div className="px-4 py-3">
                  <div className="flex justify-end mb-1 min-h-[26px]">{tick}</div>
                  <PartEditorBody p={p} d={d} />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export interface QaCheck { key: string; ok: boolean; label: string; detail?: string }

/** Live QA for one segment, in the spirit of Anuvaad's QA panel: numbers, Latin words, watch-words, full stop, empty. */
export function qaFor(p: ClientPart, answers: Answers, watch: string[]): QaCheck[] {
  const a = answers[p.id];
  const fields = p.fields.filter((f) => !f.numeric && f.en);
  const texts = fields.map((f) => a?.fields[f.key] ?? "");
  const all = texts.join(" ");
  const locked = new Set(fields.flatMap((f) => f.locked));
  const empty = fields.filter((f, i) => f.en.trim() && !texts[i].trim()).length;
  const missingNums = fields.flatMap((f, i) => f.locked.filter((tok) => f.en.includes(tok) && !texts[i].includes(tok)));
  // words inside locked number chips ("83 per cent") are not the player's English
  const unlocked = [...locked].sort((a, b) => b.length - a.length).reduce((x, tok) => x.split(tok).join(" "), all);
  const latin = (unlocked.match(/[A-Za-z][A-Za-z'’-]+/g) ?? []).filter((w) => !/^[IVXLC]+$/.test(w));
  const flagged = watch.filter((w) => w && all.includes(w));
  const needsStop = (p.type === "body" || p.type === "headnote") && /[.]\s*$/.test(fields[0]?.en ?? "") && !!texts[0]?.trim();
  const out: QaCheck[] = [
    { key: "empty", ok: empty === 0, label: t("round.qa.empty"), detail: empty ? t("round.qa.emptyN", { n: empty }) : undefined },
    { key: "numbers", ok: missingNums.length === 0, label: t("round.qa.numbers"), detail: missingNums.slice(0, 4).join(", ") || undefined },
    { key: "latin", ok: latin.length === 0, label: t("round.qa.latin"), detail: latin.slice(0, 4).join(", ") || undefined },
    { key: "watch", ok: flagged.length === 0, label: t("round.qa.watch"), detail: flagged.slice(0, 4).join(", ") || undefined },
  ];
  if (needsStop) out.push({ key: "stop", ok: /[।?!:]\s*$/.test(texts[0]), label: t("round.qa.stop") });
  return out;
}

/** Right-hand context panel: segment glossary (ranked approved forms, one-tap insert) + QA + page progress. */
export function ContextPanel({ part, index, total, terms, answers, watch, readOnly, onInsert, onGlossary, pageDone, pageTotal }: {
  part: ClientPart | null;
  index: number;
  total: number;
  terms: SourceTerm[];
  answers: Answers;
  watch: string[];
  readOnly: boolean;
  onInsert(hi: string): void;
  onGlossary(q: string): void;
  pageDone: number;
  pageTotal: number;
}) {
  const unique = useMemo(() => {
    const m = new Map<string, SourceTerm>();
    for (const x of terms) if (!m.has(x.en.toLowerCase())) m.set(x.en.toLowerCase(), x);
    return [...m.values()];
  }, [terms]);
  const text = part ? Object.values(answers[part.id]?.fields ?? {}).join(" ") : "";
  const qa = part ? qaFor(part, answers, watch) : [];
  return (
    <aside className="card overflow-hidden text-[14px]" translate="no" aria-label={t("round.context.title")}>
      <div className="px-4 py-2.5 bg-navy text-white hud-grid flex items-center gap-2">
        <Icon name="layers" size={16} className="text-gold-light" />
        <span className="font-bold">{t("round.context.title")}</span>
        {part && <span className="ml-auto text-xs text-blue-100/80 tnum">{t("round.context.segment", { n: index, total })}</span>}
      </div>
      {!part ? (
        <p className="p-4 text-muted">{t("round.context.pick")}</p>
      ) : (
        <div className="divide-y divide-slate-100">
          <section className="p-4">
            <div className="kicker mb-2 flex items-center gap-1.5"><Icon name="book" size={13} />{t("round.context.glossary")}</div>
            {unique.length === 0 ? <p className="text-muted text-[13px]">{t("round.context.noTerms")}</p> : (
              <ul className="space-y-2.5">
                {unique.map((x) => {
                  const options = [x.hi, ...x.variants].filter(Boolean);
                  const usedOk = options.some((o) => text.includes(o));
                  const usedBad = x.avoid.find((a) => a && text.includes(a));
                  return (
                    <li key={x.en} className="rounded-md border border-slate-200 p-2.5">
                      <div className="flex items-center gap-2">
                        <span className="en font-semibold text-navy">{x.en}</span>
                        {x.area && <span className="rounded bg-gold-soft border border-gold-light px-1.5 text-[10px] font-bold uppercase text-gold-deep">{x.area}</span>}
                        <span className="ml-auto">{usedOk && !usedBad ? <Icon name="check" size={15} className="text-success" title={t("round.context.used")} /> : usedBad ? <Icon name="alert" size={15} className="text-primary-strong" title={t("round.context.avoidUsed")} /> : null}</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {options.slice(0, 4).map((o, i) => (
                          <button key={o} disabled={readOnly} onMouseDown={(e) => e.preventDefault()} onClick={() => onInsert(o)}
                            className={`rounded px-2 py-0.5 text-[15px] border transition disabled:opacity-50 ${i === 0 ? "bg-gold-soft border-gold-light font-semibold text-navy hover:border-gold" : "bg-white border-slate-200 hover:border-navy"}`}
                            title={t("round.context.insert")}>{o}</button>
                        ))}
                      </div>
                      {x.alternatives?.map((alt) => <div key={alt.hi} className="mt-1 text-[12px] text-muted">{alt.area ?? t("round.context.general")}: {alt.hi}</div>)}
                      {x.avoid.length > 0 && <div className="mt-1 text-[12px] text-muted">{t("glossary.avoid")}: <s>{x.avoid.slice(0, 3).join(", ")}</s></div>}
                    </li>
                  );
                })}
              </ul>
            )}
            <button className="mt-3 text-[13px] font-semibold text-navy-600 inline-flex items-center gap-1 hover:underline" onClick={() => onGlossary("")}><Icon name="search" size={13} />{t("round.context.search")}</button>
          </section>
          <section className="p-4">
            <div className="kicker mb-2 flex items-center gap-1.5"><Icon name="shield" size={13} />{t("round.context.qa")}</div>
            <ul className="space-y-1.5">
              {qa.map((q) => (
                <li key={q.key} className="flex items-start gap-2">
                  <span className={`mt-0.5 w-4 h-4 rounded-full grid place-items-center ${q.ok ? "bg-success text-white" : "bg-primary-soft text-primary-strong border border-orange-200"}`}><Icon name={q.ok ? "check" : "dot"} size={11} stroke={3} /></span>
                  <span className={q.ok ? "text-muted" : "text-navy font-semibold"}>{q.label}{!q.ok && q.detail && <span className="block font-normal text-[12px] text-muted">{q.detail}</span>}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="p-4">
            <div className="flex items-center justify-between text-[13px]"><span className="kicker">{t("round.context.thisPage")}</span><span className="font-bold tnum">{pageDone} / {pageTotal}</span></div>
            <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-success transition-all" style={{ width: `${(pageDone / (pageTotal || 1)) * 100}%` }} /></div>
          </section>
        </div>
      )}
    </aside>
  );
}
