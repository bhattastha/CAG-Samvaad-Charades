import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { FastifyInstance } from "fastify";
import { io } from "socket.io-client";
import { roundOf } from "@hc/shared";
import { z } from "zod";
import { readSession, requirePlayer } from "../auth.js";
import { asrFile, isConfigured, tts } from "../bhashini/client.js";
import { rateOk, transliterate, WORD } from "../bhashini/xlit.js";
import { config, line, strings } from "../content.js";
import type { Db } from "../db.js";
import { env, ROOT } from "../env.js";
import { firstName, summaryFor, type AttemptRow } from "../game.js";
import { loadPage } from "../pages.js";
import { answer } from "../sahayika/engine.js";
import { parse } from "./util.js";

const AUDIO_DIR = resolve(ROOT, ".data/audio");
const ttsCache = new Map<string, Buffer>();

export async function serviceRoutes(app: FastifyInstance, db: Db) {
  // ---------- transliteration proxy (translation editor only) ----------
  app.get("/xlit", async (req, reply) => {
    const pid = requirePlayer(req, reply);
    if (!pid) return;
    const { word } = parse(z.object({ word: z.string().regex(WORD) }), req.query);
    if (!rateOk(pid)) return reply.code(429).send({ error: "rate", suggestions: [] });
    const ctl = new AbortController();
    req.raw.on("close", () => ctl.abort()); // stale requests are aborted by the client
    return transliterate(word, ctl.signal);
  });

  // ---------- Sahayika chat ----------
  app.post("/sahayika/chat", async (req, reply) => {
    const pid = requirePlayer(req, reply);
    if (!pid) return;
    const body = parse(z.object({
      attemptId: z.string().optional(),
      quick: z.enum(["hint", "score", "glossary", "time", "credits"]).optional(),
      question: z.string().max(500).optional(),
    }), req.body);
    const { player, summary } = await summaryFor(db, pid);
    let a: AttemptRow | null = null;
    if (body.attemptId) a = await db.one<AttemptRow>("SELECT * FROM attempts WHERE id=$1 AND player_id=$2 AND status='active'", [body.attemptId, pid]);
    if (a && a.chat_count >= config().sahayika.chatMaxQuestionsPerAttempt) {
      return { en: "", hi: strings.sahayikaExtra.chatLimit, spoken: false, limit: true };
    }
    const p = a ? await loadPage(db, a.page_id) : null;
    const ctx = {
      config: config(),
      round: a ? roundOf(config(), a.round_key) : null,
      page: p?.page ?? null,
      extras: p?.extras ?? null,
      answers: a?.answers ?? {},
      name: firstName(player!.name),
      timeLeftSeconds: a ? Math.max(0, (new Date(a.deadline_at).getTime() - Date.now()) / 1000) : null,
      chance: a?.chance_no ?? null,
      totalCredits: summary.totalCredits,
    };
    const res = await answer(ctx, body.quick ?? null, body.question ?? "");
    if (a) await db.query("UPDATE attempts SET chat_count = chat_count + 1 WHERE id=$1", [a.id]);
    await db.query("INSERT INTO chat_logs (player_id, attempt_id, question, en, hi, source, blocked) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [pid, a?.id ?? null, body.quick ? `[${body.quick}]` : body.question ?? "", res.en, res.hi, res.source, res.blocked]);
    return { en: res.en, hi: res.hi, spoken: res.spoken, remaining: a ? config().sahayika.chatMaxQuestionsPerAttempt - a.chat_count - 1 : null };
  });

  // ---------- Sahayika voice ----------
  app.get("/sahayika/audio/:lineId", async (req, reply) => {
    const { lineId } = parse(z.object({ lineId: z.string().regex(/^[a-z_.0-9]+$/) }), req.params);
    const f = resolve(AUDIO_DIR, `${lineId}.wav`);
    if (!line(lineId) || !existsSync(f)) return reply.code(404).send({ error: "no_audio" });
    return reply.type("audio/wav").header("Cache-Control", "no-cache").send(readFileSync(f));
  });

  app.post("/sahayika/tts", async (req, reply) => {
    if (!req.session?.email) return reply.code(401).send({ error: "not_signed_in" });
    const { text } = parse(z.object({ text: z.string().min(1).max(400) }), req.body);
    if (!isConfigured("tts")) return reply.code(503).send({ error: "tts_unavailable" });
    const k = createHash("sha1").update(text).digest("hex");
    try {
      let buf = ttsCache.get(k);
      if (!buf) {
        buf = await tts(text);
        ttsCache.set(k, buf);
        if (ttsCache.size > 500) ttsCache.delete(ttsCache.keys().next().value!);
      }
      return reply.type("audio/wav").send(buf);
    } catch {
      return reply.code(503).send({ error: "tts_unavailable" });
    }
  });

  // ---------- ASR (परख only) ----------
  app.post("/speech/asr", async (req, reply) => {
    const pid = requirePlayer(req, reply);
    if (!pid) return;
    const { audio } = parse(z.object({ audio: z.string().max(4_000_000) }), req.body);
    const a = await db.one<AttemptRow>("SELECT * FROM attempts WHERE player_id=$1 AND status='active'", [pid]);
    if (!a || !roundOf(config(), a.round_key).voiceTyping) return reply.code(403).send({ error: "voice_not_in_round" });
    if (!isConfigured("asr")) return reply.code(503).send({ error: "asr_unavailable" });
    try {
      return { text: await asrFile(audio) };
    } catch {
      return reply.code(503).send({ error: "asr_unavailable" });
    }
  });

  app.get("/speech/asr/stream", { websocket: true }, async (socket, req) => {
    const s = await readSession(req);
    const a = s?.pid ? await db.one<AttemptRow>("SELECT * FROM attempts WHERE player_id=$1 AND status='active'", [s.pid]) : null;
    if (!a || !roundOf(config(), a.round_key).voiceTyping) {
      socket.send(JSON.stringify({ type: "error", error: "voice_not_in_round" }));
      return socket.close();
    }
    if (!isConfigured("asr")) {
      socket.send(JSON.stringify({ type: "unavailable" }));
      return socket.close();
    }
    // Browser → this relay → Dhruva over Socket.IO. The key never reaches the browser.
    const up = io("wss://dhruva-api.bhashini.gov.in", { path: "/socket.io", transports: ["websocket"], auth: { authorization: env.DHRUVA_ASR_KEY }, reconnection: false, timeout: 8000 });
    let ready = false;
    const dataEvent = process.env.DHRUVA_ASR_DATA_EVENT ?? "data";
    up.on("connect", () => up.emit("start", [{ taskType: "asr", config: { language: { sourceLanguage: "hi" }, serviceId: config().bhashiniServices.asrHindi, samplingRate: 16000, postProcessors: ["punctuation"] } }]));
    up.on("ready", () => { ready = true; socket.send(JSON.stringify({ type: "ready" })); });
    up.on("response", (r: any) => {
      const text = r?.pipelineResponse?.[0]?.output?.[0]?.source ?? "";
      socket.send(JSON.stringify({ type: "text", text, final: !r?.meta?.isIntermediateResult }));
    });
    const fail = () => { try { socket.send(JSON.stringify({ type: "unavailable" })); socket.close(); } catch { /* closed */ } };
    up.on("connect_error", fail);
    up.on("error", fail);
    up.on("disconnect", () => { try { socket.close(); } catch { /* closed */ } });
    socket.on("message", (m: Buffer, isBinary: boolean) => {
      if (isBinary && ready) up.emit(dataEvent, m);
      else if (!isBinary && String(m) === "stop") up.emit("stop");
    });
    socket.on("close", () => up.close());
  });
}
