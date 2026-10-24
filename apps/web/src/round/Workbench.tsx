import { useMemo } from "react";
import type { Answers, ClientPart } from "@hc/shared";
import { t } from "../lib/strings";
import { Icon } from "../components/Icon";
import { PartEditorBody, PartSource, TickButton, type DraftProps } from "./PageViews";
import type { SourceTerm } from "./useAttempt";

/**
 * Translation workbench in the CAG Anuvaad layout: one row per segment (English source | Hindi target), equal columns,
 * the focused segment highlighted. Glossary lives inline: underlined terms on both sides open a dropdown menu.
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
            <div className="grid md:grid-cols-2">
              <div className="min-w-0 px-4 py-3 md:border-r border-slate-100">
                {head}
                <div className="mt-1.5 no-select en text-[15px] leading-[1.65] text-navy" onCopy={(e) => e.preventDefault()}><PartSource p={p} terms={terms} onTerm={onTerm} /></div>
              </div>
              <div className="min-w-0 px-4 py-3">
                <div className="flex justify-end mb-1 min-h-[26px]">{tick}</div>
                <PartEditorBody p={p} d={d} />
              </div>
            </div>
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
