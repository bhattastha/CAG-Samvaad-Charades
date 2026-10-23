import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { RoundKey } from "@hc/shared";
import { requirePlayer } from "../auth.js";
import { config } from "../content.js";
import type { Db } from "../db.js";
import { attemptView, autosave, GameError, logEvent, ownAttempt, report, review, startAttempt, submit } from "../game.js";
import { parse } from "./util.js";

const Answers = z.record(z.object({ fields: z.record(z.string().max(20_000)), done: z.boolean() }));
const LEAVE_TYPES = new Set(["left_tab", "left_fullscreen", "left_blur"]);

export async function playRoutes(app: FastifyInstance, db: Db) {
  app.post("/rounds/:key/attempts", async (req, reply) => {
    const pid = requirePlayer(req, reply);
    if (!pid) return;
    const { key } = parse(z.object({ key: RoundKey }), req.params);
    const { clientId } = parse(z.object({ clientId: z.string().min(8).max(64) }), req.body);
    const a = await startAttempt(db, pid, key, clientId, req.session?.sid);
    return attemptView(db, a, clientId);
  });

  app.get("/attempts/:id", async (req, reply) => {
    const pid = requirePlayer(req, reply);
    if (!pid) return;
    const { id } = parse(z.object({ id: z.string() }), req.params);
    const { clientId } = parse(z.object({ clientId: z.string().max(64).optional() }), req.query);
    return attemptView(db, await ownAttempt(db, pid, id), clientId);
  });

  // Autosave: PUT from the app, POST from navigator.sendBeacon on pagehide.
  const save = async (req: any, reply: any) => {
    const pid = requirePlayer(req, reply);
    if (!pid) return;
    const { id } = parse(z.object({ id: z.string() }), req.params);
    const body = parse(z.object({ version: z.number().int().nonnegative(), clientId: z.string().max(64), answers: Answers }), typeof req.body === "string" ? JSON.parse(req.body) : req.body);
    return autosave(db, await ownAttempt(db, pid, id), body as any);
  };
  app.put("/attempts/:id/autosave", save);
  app.post("/attempts/:id/autosave", save);

  app.post("/attempts/:id/events", async (req, reply) => {
    const pid = requirePlayer(req, reply);
    if (!pid) return;
    const { id } = parse(z.object({ id: z.string() }), req.params);
    const { type, meta } = parse(z.object({ type: z.string().max(40), meta: z.record(z.unknown()).optional() }), req.body);
    const a = await ownAttempt(db, pid, id);
    if (a.status !== "active") return { ok: true, ignored: true };
    if (LEAVE_TYPES.has(type)) {
      // one count per departure, 2 s debounce (blur + visibilitychange often fire together)
      const last = await db.one<{ at: Date }>("SELECT at FROM attempt_events WHERE attempt_id=$1 AND type = ANY($2) ORDER BY at DESC LIMIT 1", [id, [...LEAVE_TYPES]]);
      if (!last || Date.now() - new Date(last.at).getTime() > 2000) {
        await db.query("UPDATE attempts SET left_page_count = left_page_count + 1 WHERE id=$1", [id]);
        await logEvent(db, id, type, meta);
      }
    } else if (type === "paste_blocked") {
      await db.query("UPDATE attempts SET paste_blocked_count = paste_blocked_count + 1 WHERE id=$1", [id]);
      await logEvent(db, id, type, meta);
    } else if (type === "xlit_accept") {
      // telemetry: which suggestion index was accepted; never the typed word (§9.2)
      const idx = Math.max(0, Math.min(5, Number((meta as any)?.index ?? 0)));
      await db.query(
        "INSERT INTO xlit_stats (day, accepted_index, count) VALUES (current_date, $1, 1) ON CONFLICT (day, accepted_index) DO UPDATE SET count = xlit_stats.count + 1",
        [idx],
      );
      return { ok: true };
    } else {
      await logEvent(db, id, type, meta);
    }
    const r = await db.one<{ left_page_count: number }>("SELECT left_page_count FROM attempts WHERE id=$1", [id]);
    return { ok: true, leftPageCount: r?.left_page_count ?? 0 };
  });

  app.post("/attempts/:id/submit", async (req, reply) => {
    const pid = requirePlayer(req, reply);
    if (!pid) return;
    const { id } = parse(z.object({ id: z.string() }), req.params);
    const body = parse(z.object({ version: z.number().int().optional(), clientId: z.string().max(64).optional(), answers: Answers.optional() }), req.body);
    let a = await ownAttempt(db, pid, id);
    // final save with the submit itself, so the last keystrokes count (allowed until deadline + grace)
    if (body.answers && body.clientId && a.status === "active") {
      try {
        await autosave(db, a, { version: body.version ?? a.answers_version + 1, clientId: body.clientId, answers: body.answers as any });
        a = await ownAttempt(db, pid, id);
      } catch (e) {
        if (!(e instanceof GameError) || e.code === "other_window") throw e;
      }
    }
    const done = await submit(db, a, false);
    return { ok: true, score: done.score };
  });

  app.get("/attempts/:id/report", async (req, reply) => {
    const pid = requirePlayer(req, reply);
    if (!pid) return;
    const { id } = parse(z.object({ id: z.string() }), req.params);
    return report(db, await ownAttempt(db, pid, id));
  });

  app.get("/attempts/:id/review", async (req, reply) => {
    const pid = requirePlayer(req, reply);
    if (!pid) return;
    const { id } = parse(z.object({ id: z.string() }), req.params);
    return review(db, await ownAttempt(db, pid, id));
  });

  app.get("/attempts/:id/clock", async (req, reply) => {
    const pid = requirePlayer(req, reply);
    if (!pid) return;
    const { id } = parse(z.object({ id: z.string() }), req.params);
    const a = await ownAttempt(db, pid, id);
    return { serverNow: new Date(), deadlineAt: a.deadline_at, status: a.status, activeClientId: a.active_client_id, graceSeconds: config().fairPlay.graceSecondsAfterDeadline };
  });
}
