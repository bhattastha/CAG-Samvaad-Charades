import { buildApp } from "./app.js";
import { openDb } from "./db.js";
import { env } from "./env.js";
import { seedAll } from "./seed.js";

const db = await openDb();
await seedAll(db, () => {}); // idempotent: migrations + reference data
const app = await buildApp(db, { logger: true });
await app.listen({ port: env.PORT, host: env.HOST });
const stop = async () => { await app.close(); await db.close(); process.exit(0); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
