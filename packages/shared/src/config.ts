import { z } from "zod";

export const RoundKey = z.enum(["trial", "primary", "secondary", "pro"]);
export type RoundKey = z.infer<typeof RoundKey>;

const RoundSchema = z.object({
  key: RoundKey,
  name: z.string().min(1),
  nameEn: z.string().min(1),
  title: z.string().min(1),
  timeLimitMinutes: z.number().positive(),
  creditCap: z.number().nonnegative(),
  bhashiniDraft: z.boolean(),
  voiceTyping: z.boolean(),
  completionCountedBy: z.enum(["sentence", "paragraph"]),
  titleEn: z.string().default(""),
  titleMeaning: z.string().default(""),
  levelLabel: z.string().default(""),
});
export type RoundConfig = z.infer<typeof RoundSchema>;

export const GameConfigSchema = z
  .object({
    game: z.object({ name: z.string(), nameEn: z.string(), guide: z.string(), guideEn: z.string() }),
    registration: z.object({ credits: z.number().nonnegative() }),
    rounds: z.array(RoundSchema).length(4),
    maxCredits: z.number().positive(),
    maxChancesPerRound: z.number().int().positive(),
    bestOfChancesCounts: z.boolean(),
    titlePassMark: z.number().min(0).max(100),
    scoreOutOf: z.number().positive(),
    scoringWeights: z.object({
      translation: z.number(),
      completion: z.number(),
      sentenceConstruction: z.number(),
      glossary: z.number(),
      time: z.number(),
    }),
    timeMarks: z.object({
      fullMarksIfFinishedWithinShareOfLimit: z.number().min(0).max(1),
      marksAtTimeLimit: z.number().min(0).max(1),
    }),
    creditDecimals: z.number().int().min(0).max(3),
    creditsBelowPassMark: z.boolean(),
    roundUnlockRule: z.string(),
    fairPlay: z.object({
      warnAtMinutesLeft: z.number(),
      warnAtMinutesLeftSecond: z.number(),
      confirmSubmitWindowSeconds: z.number(),
      autosaveIntervalSeconds: z.number(),
      graceSecondsAfterDeadline: z.number(),
    }),
    stars: z.object({ total: z.number().int() }),
    trialSentenceTerminator: z.string(),
    sahayika: z.object({
      maxSpokenSentences: z.number().int(),
      chatMaxQuestionsPerAttempt: z.number().int(),
      llmServiceId: z.string(),
      quickQuestions: z.array(z.string()),
    }),
    glossary: z.object({ transliterationAvoidThreshold: z.number() }),
    scoring: z.object({
      provider: z.enum(["local", "anuvad"]),
      anuvadTimeoutSeconds: z.number(),
      chrfOrder: z.number().int().positive(),
      chrfBeta: z.number().positive(),
      chrfFloor: z.number(),
      chrfCeil: z.number(),
      minWordsPerSentence: z.number().int(),
    }),
    auth: z.object({ mode: z.string(), otpLength: z.number().int(), otpTtlMinutes: z.number() }),
    ui: z.object({
      locale: z.enum(["en", "hi"]).default("en"),
      translationPlugin: z.object({ enabled: z.boolean(), scriptUrl: z.string(), languages: z.array(z.string()) }).default({ enabled: false, scriptUrl: "", languages: ["hi", "en"] }),
    }).default({}),
    bhashiniServices: z.object({
      translation: z.string(), asrHindi: z.string(), ttsEnglish: z.string(), ttsGender: z.enum(["female", "male"]), transliteration: z.string(),
    }).default({ translation: "ai4bharat/indictrans-v2-all-gpu--t4", asrHindi: "ai4bharat/conformer-hi-gpu--t4", ttsEnglish: "Bhashini/IITM/TTS", ttsGender: "female", transliteration: "ai4bharat/indicxlit--cpu-fsv2" }),
    transliteration: z.object({
      endpoint: z.string().url(),
      serviceId: z.string(),
      sourceLanguage: z.string(),
      targetLanguage: z.string(),
      targetLanguageScriptCode: z.string(),
      isSentence: z.boolean(),
      numSuggestions: z.number().int().min(1).max(8),
      minInputChars: z.number().int(),
      debounceMs: z.number().int(),
      timeoutMs: z.number().int(),
    }),
  })
  .passthrough()
  .superRefine((c, ctx) => {
    const sum = c.registration.credits + c.rounds.reduce((s, r) => s + r.creditCap, 0);
    if (Math.abs(sum - c.maxCredits) > 1e-9) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `registration.credits + Σ creditCap = ${sum}, but maxCredits = ${c.maxCredits}`,
      });
    }
    const keys = c.rounds.map((r) => r.key).join(",");
    if (keys !== "trial,primary,secondary,pro") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `rounds must be trial,primary,secondary,pro in order (got ${keys})` });
    }
  });

export type GameConfig = z.infer<typeof GameConfigSchema>;

/** Throws with a readable message if the config is invalid. */
export function parseGameConfig(raw: unknown): GameConfig {
  const r = GameConfigSchema.safeParse(raw);
  if (!r.success) {
    throw new Error("Invalid game.config.json:\n" + r.error.issues.map((i) => ` - ${i.path.join(".")}: ${i.message}`).join("\n"));
  }
  return r.data;
}

/** The subset safe to expose at GET /config. */
export function publicConfig(c: GameConfig) {
  return {
    game: c.game,
    registration: c.registration,
    rounds: c.rounds,
    maxCredits: c.maxCredits,
    maxChancesPerRound: c.maxChancesPerRound,
    titlePassMark: c.titlePassMark,
    scoreOutOf: c.scoreOutOf,
    scoringWeights: c.scoringWeights,
    creditDecimals: c.creditDecimals,
    fairPlay: c.fairPlay,
    stars: c.stars,
    trialSentenceTerminator: c.trialSentenceTerminator,
    sahayika: { quickQuestions: c.sahayika.quickQuestions, chatMaxQuestionsPerAttempt: c.sahayika.chatMaxQuestionsPerAttempt },
    transliteration: { debounceMs: c.transliteration.debounceMs, numSuggestions: c.transliteration.numSuggestions },
    auth: { otpLength: c.auth.otpLength },
    scoring: { minWordsPerSentence: c.scoring.minWordsPerSentence },
    ui: c.ui,
  };
}
export type PublicConfig = ReturnType<typeof publicConfig>;

export function roundOf(c: { rounds: RoundConfig[] }, key: string): RoundConfig {
  const r = c.rounds.find((x) => x.key === key);
  if (!r) throw new Error(`Unknown round ${key}`);
  return r;
}
