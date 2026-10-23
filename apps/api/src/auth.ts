import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { SignJWT, jwtVerify } from "jose";
import { config } from "./content.js";
import type { Db } from "./db.js";
import { env } from "./env.js";

const COOKIE = "hc_session";
const key = new TextEncoder().encode(env.JWT_SECRET);
const DEV_CODE = "123456";
const OTP_PER_HOUR = 5;
const MAX_TRIES = 5;

export interface Session { email: string; pid?: string; role?: "manager" | "viewer" }

declare module "fastify" {
  interface FastifyRequest { session: Session | null }
}

const hash = (email: string, code: string) => createHash("sha256").update(`${email}:${code}:${env.JWT_SECRET}`).digest("hex");
export const normEmail = (e: string) => e.trim().toLowerCase();
const allowedDomains = (process.env.ALLOWED_EMAIL_DOMAINS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
export const emailAllowed = (e: string) => !allowedDomains.length || allowedDomains.some((d) => e.endsWith("@" + d));

/** Pluggable OTP sender: SMTP when configured; in development the code is logged and is always 123456. */
async function sendOtp(email: string, code: string) {
  if (env.SMTP_URL) {
    const { createTransport } = await import("nodemailer");
    await createTransport(env.SMTP_URL).sendMail({
      from: env.OTP_FROM,
      to: email,
      subject: "हिंदी शराड्स: आपका कोड",
      text: `आपका हिंदी शराड्स कोड: ${code}\nयह ${config().auth.otpTtlMinutes} मिनट तक चलेगा।`,
    });
  } else if (env.isDev) {
    console.log(`[otp] ${email} → ${code} (development)`);
  } else {
    throw new Error("No OTP sender configured (set SMTP_URL)");
  }
}

export async function requestOtp(db: Db, email: string): Promise<{ ok: true; devCode?: string } | { ok: false; status: number; error: string }> {
  const now = new Date();
  const row = await db.one<{ sent_count: number; window_start: Date }>("SELECT sent_count, window_start FROM otp_challenges WHERE email=$1", [email]);
  const inWindow = row && now.getTime() - new Date(row.window_start).getTime() < 3600_000;
  if (row && inWindow && row.sent_count >= OTP_PER_HOUR) return { ok: false, status: 429, error: "otp_rate" };
  const len = config().auth.otpLength;
  const code = env.isDev && !env.SMTP_URL ? DEV_CODE : String(randomInt(0, 10 ** len)).padStart(len, "0");
  const expires = new Date(now.getTime() + config().auth.otpTtlMinutes * 60_000);
  await db.query(
    `INSERT INTO otp_challenges (email, code_hash, expires_at, tries, sent_count, window_start) VALUES ($1,$2,$3,0,1,now())
     ON CONFLICT (email) DO UPDATE SET code_hash=$2, expires_at=$3, tries=0,
       sent_count = CASE WHEN $4::boolean THEN otp_challenges.sent_count + 1 ELSE 1 END,
       window_start = CASE WHEN $4::boolean THEN otp_challenges.window_start ELSE now() END`,
    [email, hash(email, code), expires, !!inWindow],
  );
  await sendOtp(email, code);
  return { ok: true, ...(env.isDev && !env.SMTP_URL ? { devCode: DEV_CODE } : {}) };
}

export async function verifyOtp(db: Db, email: string, code: string): Promise<boolean> {
  const row = await db.one<{ code_hash: string; expires_at: Date; tries: number }>("SELECT code_hash, expires_at, tries FROM otp_challenges WHERE email=$1", [email]);
  if (!row || row.tries >= MAX_TRIES || new Date(row.expires_at) < new Date()) return false;
  const a = Buffer.from(row.code_hash);
  const b = Buffer.from(hash(email, code.trim()));
  const ok = a.length === b.length && timingSafeEqual(a, b);
  if (ok) await db.query("DELETE FROM otp_challenges WHERE email=$1", [email]);
  else await db.query("UPDATE otp_challenges SET tries = tries + 1 WHERE email=$1", [email]);
  return ok;
}

export async function setSession(reply: FastifyReply, s: Session) {
  const token = await new SignJWT({ ...s }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("12h").sign(key);
  reply.setCookie(COOKIE, token, { httpOnly: true, secure: env.COOKIE_SECURE, sameSite: "lax", path: "/", maxAge: 12 * 3600 });
}
export function clearSession(reply: FastifyReply) {
  reply.clearCookie(COOKIE, { path: "/" });
}

export async function readSession(req: FastifyRequest): Promise<Session | null> {
  const t = req.cookies?.[COOKIE];
  if (!t) return null;
  try {
    const { payload } = await jwtVerify(t, key);
    return { email: String(payload.email), pid: payload.pid ? String(payload.pid) : undefined, role: payload.role as Session["role"] };
  } catch {
    return null;
  }
}

export async function adminRole(db: Db, email: string): Promise<Session["role"] | undefined> {
  if (env.ADMIN_EMAILS.includes(email)) return "manager";
  const r = await db.one<{ role: "manager" | "viewer" }>("SELECT role FROM admin_users WHERE email=$1", [email]);
  return r?.role;
}

export function requirePlayer(req: FastifyRequest, reply: FastifyReply): string | null {
  if (!req.session?.pid) {
    reply.code(401).send({ error: "not_signed_in" });
    return null;
  }
  return req.session.pid;
}
export function requireAdmin(req: FastifyRequest, reply: FastifyReply, need: "viewer" | "manager" = "viewer"): string | null {
  const r = req.session?.role;
  if (!r || (need === "manager" && r !== "manager")) {
    reply.code(403).send({ error: "forbidden" });
    return null;
  }
  return req.session!.email;
}
