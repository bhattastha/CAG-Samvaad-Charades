import type { ZodType } from "zod";

export class BadRequest extends Error {
  constructor(public issues: unknown) { super("bad_request"); }
}

/** Zod on every body/query/params (§14); errors become 400s in the error handler. */
export function parse<T>(schema: ZodType<T>, input: unknown): T {
  const r = schema.safeParse(input ?? {});
  if (!r.success) throw new BadRequest(r.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  return r.data;
}
