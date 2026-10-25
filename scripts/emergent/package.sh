#!/usr/bin/env bash
# Packages the monorepo for Emergent's native hosting (run before every publish):
#   backend/hc/   = single-file Node API bundle + the config/content/seed files it reads at runtime
#   frontend/site/ = prebuilt web app (frontend `yarn build` just copies it to build/)
set -euo pipefail
ROOT=/app
cd "$ROOT"
corepack pnpm --filter @hc/web build >/tmp/hc-web-build.log 2>&1 || { tail -20 /tmp/hc-web-build.log; exit 1; }

OUT=$ROOT/backend/hc
rm -rf "$OUT" && mkdir -p "$OUT/vendor"
ESBUILD=$(ls -d node_modules/.pnpm/esbuild@*/node_modules/esbuild/bin/esbuild | sort -V | tail -1)
(cd apps/api && "$ROOT/$ESBUILD" src/server.ts --bundle --platform=node --format=esm --target=node20 \
  --external:@electric-sql/pglite --external:playwright-core --external:pdfjs-dist \
  --banner:js="import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" \
  --outfile="$OUT/api.mjs" --log-level=warning)
cp apps/api/src/schema.sql "$OUT/"
cp -r config content assets "$OUT/"
mkdir -p "$OUT/seed" && cp -r seed/pages seed/offices.json seed/glossary.anuvaad.csv seed/glossary_overrides.json "$OUT/seed/"
# externals ship under vendor/ (a node_modules folder is git-ignored) and the bundle imports them by path
cp -rL node_modules/.pnpm/@electric-sql+pglite@*/node_modules/@electric-sql/pglite "$OUT/vendor/pglite"
cp -rL node_modules/.pnpm/pdfjs-dist@*/node_modules/pdfjs-dist "$OUT/vendor/pdfjs-dist"
rm -rf "$OUT/vendor/pdfjs-dist/node_modules" "$OUT/vendor/pglite/node_modules"
sed -i 's#import("@electric-sql/pglite")#import("./vendor/pglite/dist/index.js")#; s#import("pdfjs-dist/legacy/build/pdf.mjs")#import("./vendor/pdfjs-dist/legacy/build/pdf.mjs")#' "$OUT/api.mjs"
grep -q 'vendor/pglite/dist/index.js' "$OUT/api.mjs" && grep -q 'vendor/pdfjs-dist/legacy' "$OUT/api.mjs" || { echo "vendor import rewrite failed"; exit 1; }

rm -rf "$ROOT/frontend/site" && cp -r apps/web/dist "$ROOT/frontend/site"
echo "packaged: $(du -sh "$OUT" | cut -f1) api bundle, $(du -sh "$ROOT/frontend/site" | cut -f1) site"
