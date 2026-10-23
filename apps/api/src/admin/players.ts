import { config } from "../content.js";
import type { Db } from "../db.js";
import { loadAgg, summariesFor } from "./analytics.js";

/** Player directory for the console: one row per officer with computed progress (never stored, §6). */
export async function listPlayers(db: Db) {
  const { players, attempts } = await loadAgg(db);
  const summaries = summariesFor(players, attempts);
  const rows = await db.query<{ id: string; mobile: string; office_address: string }>("SELECT id, mobile, office_address FROM players");
  const extra = new Map(rows.map((r) => [r.id, r]));
  return players.map((p) => {
    const mine = attempts.filter((a) => a.player_id === p.id);
    const s = summaries.get(p.id)!;
    const last = Math.max(+new Date(p.registered_at), ...mine.map((a) => Math.max(+new Date(a.started_at), a.last_saved_at ? +new Date(a.last_saved_at) : 0, a.submitted_at ? +new Date(a.submitted_at) : 0)));
    const playedLevels = s.rounds.filter((r) => r.played > 0).length;
    return {
      id: p.id, email: p.email, name: p.name, mobile: extra.get(p.id)?.mobile ?? "",
      officeId: p.office_id, office: p.office_name, city: p.city, state: p.state,
      registeredAt: p.registered_at, lastActiveAt: new Date(last),
      attempts: mine.length, inProgress: mine.some((a) => a.status === "active"),
      leaves: mine.reduce((n, a) => n + a.left_page_count, 0), pasteBlocks: mine.reduce((n, a) => n + a.paste_blocked_count, 0),
      autoSubmits: mine.filter((a) => a.auto_submitted).length,
      trialPassed: s.trialPassed, playedLevels, titles: s.rounds.filter((r) => r.titleEarned).length,
      totalCredits: s.totalCredits, stars: s.stars,
      rounds: s.rounds.map((r) => ({ key: r.key, best: r.best, chancesUsed: r.chancesUsed, credits: r.credits, titleEarned: r.titleEarned, playable: r.playable })),
    };
  }).sort((a, b) => +b.lastActiveAt - +a.lastActiveAt);
}

export async function playerDetail(db: Db, id: string) {
  const p = await db.one<any>(
    "SELECT p.id, p.email, p.name, p.mobile, p.office_address, p.registered_at, p.registration_credits, o.name_en AS office, o.city, o.state FROM players p LEFT JOIN offices o ON o.id=p.office_id WHERE p.id=$1", [id]);
  if (!p) return null;
  const list = (await listPlayers(db)).find((x) => x.id === id)!;
  const attempts = await db.query<any>(
    `SELECT a.id, a.round_key, a.chance_no, a.page_id, pg.label AS page_label, a.started_at, a.deadline_at, a.submitted_at, a.status, a.auto_submitted,
            a.score, a.measures, a.left_page_count, a.paste_blocked_count, a.chat_count, a.session_id,
            (SELECT count(*)::int FROM attempt_events e WHERE e.attempt_id=a.id) AS events
     FROM attempts a LEFT JOIN pages pg ON pg.id=a.page_id WHERE a.player_id=$1 ORDER BY a.started_at DESC`, [id]);
  const chat = await db.one<{ n: number; blocked: number }>("SELECT count(*)::int AS n, count(*) FILTER (WHERE blocked)::int AS blocked FROM chat_logs WHERE player_id=$1", [id]);
  const name = (k: string) => config().rounds.find((r) => r.key === k)?.nameEn ?? k;
  return {
    ...list, officeAddress: p.office_address, registrationCredits: Number(p.registration_credits),
    chat: chat ?? { n: 0, blocked: 0 },
    history: attempts.map((a) => ({
      id: a.id, roundKey: a.round_key, roundName: name(a.round_key), chanceNo: a.chance_no, page: a.page_label ?? a.page_id,
      startedAt: a.started_at, submittedAt: a.submitted_at, status: a.status, autoSubmitted: a.auto_submitted, score: a.score,
      minutes: a.submitted_at ? Math.round((+new Date(a.submitted_at) - +new Date(a.started_at)) / 6000) / 10 : null,
      measures: a.measures, leaves: a.left_page_count, pasteBlocks: a.paste_blocked_count, chat: a.chat_count, events: a.events, sessionId: a.session_id,
    })),
  };
}

/** Delete a player's attempts, events and chat (and optionally the player). Returns counts for the audit log. */
export async function resetPlayer(db: Db, id: string, deletePlayer: boolean) {
  return db.tx(async (q) => {
    const p = await q.one<{ email: string }>("SELECT email FROM players WHERE id=$1", [id]);
    if (!p) return null;
    const ev = await q.one<{ n: number }>("SELECT count(*)::int AS n FROM attempt_events WHERE attempt_id IN (SELECT id FROM attempts WHERE player_id=$1)", [id]);
    await q.query("DELETE FROM attempt_events WHERE attempt_id IN (SELECT id FROM attempts WHERE player_id=$1)", [id]);
    const at = await q.query("DELETE FROM attempts WHERE player_id=$1 RETURNING id", [id]);
    const ch = await q.query("DELETE FROM chat_logs WHERE player_id=$1 RETURNING id", [id]);
    if (deletePlayer) {
      await q.query("DELETE FROM players WHERE id=$1", [id]);
      await q.query("DELETE FROM otp_challenges WHERE email=$1", [p.email]);
    }
    return { email: p.email, attempts: at.length, events: ev?.n ?? 0, chats: ch.length, playerDeleted: deletePlayer };
  });
}

/** Danger zone: remove every player and all play data; content, glossary, offices, settings and audit log stay. */
export async function resetAllPlayData(db: Db) {
  return db.tx(async (q) => {
    const n = async (t: string) => (await q.one<{ n: number }>(`SELECT count(*)::int AS n FROM ${t}`))?.n ?? 0;
    const counts = { players: await n("players"), attempts: await n("attempts"), events: await n("attempt_events"), chats: await n("chat_logs"), xlitStats: await n("xlit_stats") };
    await q.query("DELETE FROM attempt_events");
    await q.query("DELETE FROM attempts");
    await q.query("DELETE FROM chat_logs");
    await q.query("DELETE FROM xlit_stats");
    await q.query("DELETE FROM otp_challenges");
    await q.query("DELETE FROM players");
    return counts;
  });
}
