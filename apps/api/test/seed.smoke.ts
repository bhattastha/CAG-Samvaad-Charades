import { openDb } from "../src/db.js";
import { seedAll } from "../src/seed.js";
const db = await openDb("pglite:memory");
const t = Date.now();
await seedAll(db);
console.log("ms", Date.now() - t);
console.log(await db.query("select en, hi, override->>'status' s from glossary_terms where override is not null"));
console.log(await db.query("select id, round_key, sample from pages"));
await db.close();
