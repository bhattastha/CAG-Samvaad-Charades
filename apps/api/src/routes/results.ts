import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requirePlayer } from "../auth.js";
import { certificateFileName, certificateHtml, renderCertificate } from "../certificate/render.js";
import type { Db } from "../db.js";
import { summaryFor } from "../game.js";
import { parse } from "./util.js";

export async function resultRoutes(app: FastifyInstance, db: Db) {
  app.get("/me/certificate", async (req, reply) => {
    const pid = requirePlayer(req, reply);
    if (!pid) return;
    const format = parse(z.object({ format: z.enum(["pdf", "png", "html"]).optional() }), req.query).format ?? "pdf";
    const { player, summary } = await summaryFor(db, pid);
    const office = await db.one<{ name_en: string; name_hi: string | null }>("SELECT name_en, name_hi FROM offices WHERE id=$1", [player!.office_id]);
    const html = certificateHtml({ name: player!.name, office: office?.name_hi || office?.name_en || "", email: player!.email, summary, issuedOn: new Date() });
    if (format === "html") return reply.type("text/html; charset=utf-8").send(html);
    const buf = await renderCertificate(html, format);
    if (!buf) return reply.type("text/html; charset=utf-8").send(html); // no Chromium: printable HTML fallback
    return reply
      .type(format === "pdf" ? "application/pdf" : "image/png")
      .header("Content-Disposition", `attachment; filename="${certificateFileName(format)}"`)
      .send(buf);
  });
}
