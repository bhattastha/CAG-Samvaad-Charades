// Copies the self-hosted Noto WOFF2 subsets used by the certificate into assets/fonts (D4).
import { copyFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nm = resolve(root, "apps/web/node_modules/@fontsource");
mkdirSync(resolve(root, "assets/fonts"), { recursive: true });
for (const w of ["400", "700"]) {
  copyFileSync(resolve(nm, `noto-sans-devanagari/files/noto-sans-devanagari-devanagari-${w}-normal.woff2`), resolve(root, `assets/fonts/noto-sans-devanagari-${w}-normal.woff2`));
  copyFileSync(resolve(nm, `noto-sans/files/noto-sans-latin-${w}-normal.woff2`), resolve(root, `assets/fonts/noto-sans-latin-${w}-normal.woff2`));
}
console.log("fonts copied");
