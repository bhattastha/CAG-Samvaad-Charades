import type { RoundKey } from "./config.js";

export type PartType =
  | "passage" | "header" | "heading" | "headnote" | "body" | "footnote" | "footer" | "page_number"
  | "table" | "chart" | "annexure_ref";

/** One editable (or read-only) string inside a part. Plain parts have a single field "t". */
export interface Field {
  key: string;
  en: string;
  hiReference: string;
  draft: string | null;
  locked: string[];
  numeric: boolean;
}
export type ClientField = Omit<Field, "hiReference">;

export interface TableLayout {
  kind: "table";
  /** field keys, row-major; first row is the header */
  rows: string[][];
  title?: string;
  note?: string;
}
export interface ChartLayout {
  kind: "chart";
  chart: "bar" | "line" | "pie";
  title?: string;
  xLabels: string[];
  series: { name?: string; values: number[] }[];
  yAxis?: string;
  source?: string;
  yTicks?: number[];
  valueDecimals?: number;
}
export type PartLayout = TableLayout | ChartLayout | null;

export interface Part {
  id: string;
  order: number;
  type: PartType;
  tickGroup: string | null;
  editable: boolean;
  layout: PartLayout;
  fields: Field[];
  /** परख only: English sentences, for linked focus */
  enSentences?: string[];
}
export type ClientPart = Omit<Part, "fields"> & { fields: ClientField[] };

export interface GlossaryEntry {
  en: string;
  hi: string;
  variants: string[];
  avoid: string[];
}

export interface PlantedSlip {
  partId: string;
  kind: "term" | "transliteration" | "grammar" | "omission";
  wrongText: string;
  enTerm: string | null;
  fixHint: string;
}

export interface PageData {
  id: string;
  roundKey: RoundKey;
  label: string;
  printedPageNo: string | null;
  parts: Part[];
  terms: GlossaryEntry[];
  slips: PlantedSlip[];
}

export interface PartAnswer {
  fields: Record<string, string>;
  done: boolean;
}
export type Answers = Record<string, PartAnswer>;

/** A target-side hint: something worth a second look in the player's Hindi. */
export interface Flag {
  partId: string;
  fieldKey: string;
  text: string;
  kind: "avoid" | "latin" | "slip" | "missing_term" | "grammar";
  enTerm?: string;
}
