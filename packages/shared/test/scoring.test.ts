import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  chrF, parseGameConfig, roundCredits, roundOf, scoreAttempt, seedToPage, summarise, timeMeasure,
  reportCardLines, romanToDevanagari, findForbidden, type Answers, type SeedPage,
} from "../src/index.js";

const root = new URL("../../../", import.meta.url);
const config = parseGameConfig(JSON.parse(readFileSync(new URL("config/game.config.json", root), "utf8")));
const seed = JSON.parse(readFileSync(new URL("seed/pages/trial_r38_page_v.json", root), "utf8")) as SeedPage;
const { page } = seedToPage(seed);
const trial = roundOf(config, "trial");
const ref = page.parts[0].fields[0].hiReference;
const ans = (t: string): Answers => ({ passage: { fields: { t }, done: false } });
const run = (t: string, used = 8 * 60) => scoreAttempt({ config, round: trial, page, answers: ans(t), usedSeconds: used });

describe("§11 scorer on the seed trial passage", () => {
  it("reference vs itself → translation 1, glossary 12/12", () => {
    const r = run(ref);
    expect(r.measures.translation).toBe(1);
    expect(r.counts.glossaryCorrect).toBe(12);
    expect(r.counts.glossaryTotal).toBe(12);
    expect(r.counts.completionDone).toBe(16);
    expect(r.score).toBe(100);
  });
  it("empty → 0", () => {
    expect(run("").score).toBe(0);
    expect(run("   ‍  ").score).toBe(0);
  });
  it("विपणन → मार्केटिंग gives glossary 11/12 and a term tip", () => {
    const r = run(ref.replaceAll("विपणन", "मार्केटिंग"));
    expect(r.counts.glossaryCorrect).toBe(11);
    expect(r.tip).toMatchObject({ kind: "term", en: "marketing", hi: "विपणन", wrong: "मार्केटिंग" });
  });
  it("time fractions 0.4 / 0.75 / 1.0 → 1.0 / 0.8 / 0.6", () => {
    expect(timeMeasure(0.4 * 1200, 1200)).toBeCloseTo(1.0);
    expect(timeMeasure(0.75 * 1200, 1200)).toBeCloseTo(0.8);
    expect(timeMeasure(1.0 * 1200, 1200)).toBeCloseTo(0.6);
    expect(timeMeasure(2 * 1200, 1200)).toBeCloseTo(0.6);
  });
  it("Latin words and missing danda lower sentence construction", () => {
    const r = run("SAIL ek company hai");
    expect(r.measures.sentence).toBeLessThan(0.9);
    expect(r.grammar.some((g) => g.code === "missing_danda")).toBe(true);
  });
  it("chrF is 1 for identity and lower for a partial", () => {
    expect(chrF("कंपनी के पास", "कंपनी के पास")).toBe(1);
    expect(chrF("कंपनी", "कंपनी के पास खदानें हैं")).toBeLessThan(0.6);
  });
});

describe("credits and totals", () => {
  it("worked examples from design 14", () => {
    expect(roundCredits(84, 3)).toBe(2.5);
    expect(roundCredits(88, 5)).toBe(4.4);
    expect(roundCredits(88, 15)).toBe(13.2);
    expect(roundCredits(92, 25)).toBe(23);
    const s = summarise(config, [
      { roundKey: "trial", chanceNo: 1, status: "submitted", score: 84 },
      { roundKey: "primary", chanceNo: 1, status: "submitted", score: 60 },
      { roundKey: "primary", chanceNo: 2, status: "submitted", score: 88 },
      { roundKey: "secondary", chanceNo: 1, status: "submitted", score: 88 },
      { roundKey: "pro", chanceNo: 1, status: "submitted", score: 92 },
    ]);
    expect(s.totalCredits).toBe(45.1);
    expect(s.stars).toBe(5);
  });
  it("a lower later score never reduces credits; 4th chance refused; rounds unlock in order", () => {
    const s = summarise(config, [
      { roundKey: "trial", chanceNo: 1, status: "submitted", score: 70 },
      { roundKey: "trial", chanceNo: 2, status: "submitted", score: 20 },
      { roundKey: "trial", chanceNo: 3, status: "submitted", score: 50 },
    ]);
    const t = s.rounds[0];
    expect(t.best).toBe(70);
    expect(t.credits).toBe(2.1);
    expect(t.chancesLeft).toBe(0);
    expect(s.rounds[1].unlocked).toBe(true);
    expect(s.rounds[2].unlocked).toBe(false);
  });
  it("below 33: credits still apply, no title", () => {
    const s = summarise(config, [{ roundKey: "trial", chanceNo: 1, status: "submitted", score: 30 }]);
    expect(s.rounds[0].titleEarned).toBe(false);
    expect(s.rounds[0].credits).toBe(0.9);
    expect(s.stars).toBe(1);
  });
});

describe("report card line selection (§10.3)", () => {
  const base = { roundKey: "primary" as const, passMark: 33, leftCount: 0, firstTimeAllPlayed: false };
  it("first chance pass", () => {
    expect(reportCardLines({ ...base, chanceNo: 1, score: 50, priorBest: null, chancesLeft: 2 }).announce[0]).toBe("primary.report_card.title_earned_first_chance");
  });
  it("first pass on retry / new best / not new best", () => {
    expect(reportCardLines({ ...base, chanceNo: 2, score: 40, priorBest: 20, chancesLeft: 1 }).announce[0]).toBe("primary.report_card.first_pass_on_retry");
    expect(reportCardLines({ ...base, chanceNo: 2, score: 60, priorBest: 40, chancesLeft: 1 }).announce[0]).toBe("primary.report_card.new_best");
    expect(reportCardLines({ ...base, chanceNo: 3, score: 30, priorBest: 40, chancesLeft: 0 }).announce[0]).toBe("primary.report_card.not_new_best");
  });
  it("so close / below pass", () => {
    expect(reportCardLines({ ...base, chanceNo: 1, score: 30, priorBest: null, chancesLeft: 2 }).announce[0]).toBe("primary.report_card.so_close");
    expect(reportCardLines({ ...base, chanceNo: 1, score: 10, priorBest: null, chancesLeft: 2 }).announce[0]).toBe("primary.report_card.below_pass_chances_left");
    expect(reportCardLines({ ...base, chanceNo: 3, score: 10, priorBest: 5, chancesLeft: 0 }).announce[0]).toBe("primary.report_card.below_pass_no_chances");
  });
});

describe("helpers", () => {
  it("fallback transliteration gives Devanagari", () => {
    expect(romanToDevanagari("sarkaar")).toBe("सरकार");
    expect(romanToDevanagari("sarkar")).toBe("सरकर");
    expect(romanToDevanagari("mera")).toBe("मेरा");
    expect(romanToDevanagari("hindi")).toBe("हिंदी");
    expect(romanToDevanagari("vistaar")).toBe("विस्तार");
    expect(romanToDevanagari("pradesh")).toBe("प्रदेश");
  });
  it("forbidden scan", () => {
    expect(findForbidden("अनुवाद पथिक")).toEqual([]);
    expect(findForbidden("Become a Guru")).toEqual(["Guru"]);
    expect(findForbidden("gurudwara")).toEqual([]);
  });
});
