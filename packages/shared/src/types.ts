import type { RoundKey } from "./config.js";

export type PartType =
  | "passage" | "header" | "heading" | "headnote" | "body" | "footnote" | "footer" | "page_number"
  | "table" | "chart" | "figure" | "annexure_ref";

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
  /** e.g. "(Amount: ₹ in crore)" */
  unit?: string;
  note?: string;
  /** the table runs over from / onto the neighbouring page of the bundle */
  continued?: boolean;
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
/** A chart, diagram or photo kept as an image (Pro); its caption, word labels and source are editable fields. */
export interface FigureLayout {
  kind: "figure";
  /** file under /figures/ (served as a static asset) */
  image: string;
  width?: number;
  height?: number;
  title?: string;
  labels: string[];
  source?: string;
}
export type PartLayout = TableLayout | ChartLayout | FigureLayout | null;

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
  /** printed page this part sits on, inside a multi-page report bundle (10/20/30 pages) */
  pageNo?: number;
}
export type ClientPart = Omit<Part, "fields"> & { fields: ClientField[] };

export interface GlossaryEntry {
  en: string;
  hi: string;
  variants: string[];
  avoid: string[];
  /** subject area (e.g. "Railways"); null/undefined = general entry */
  sector?: string | null;
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
  /** Plain text per field: the only value the scorer ever reads. */
  fields: Record<string, string>;
  done: boolean;
  /** Optional rich-text (Word-like) formatting per field, stored beside the plain text; never scored. */
  html?: Record<string, string>;
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
