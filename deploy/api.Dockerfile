# API image: Node 20 + OCR (tesseract hin, tessdata_best) + poppler + Chromium for the certificate.
FROM node:20-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @hc/api... --filter @hc/web...

FROM deps AS fonts
COPY scripts scripts
RUN node scripts/copy-fonts.mjs

FROM node:20-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
      poppler-utils tesseract-ocr chromium curl ca-certificates \
 && mkdir -p /usr/share/tesseract-ocr/5/tessdata \
 && curl -fsSL -o /usr/share/tesseract-ocr/5/tessdata/hin.traineddata https://github.com/tesseract-ocr/tessdata_best/raw/main/hin.traineddata \
 && apt-get purge -y curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules node_modules
COPY --from=deps /app/packages/shared/node_modules packages/shared/node_modules
COPY --from=deps /app/apps/api/node_modules apps/api/node_modules
COPY package.json pnpm-workspace.yaml ./
COPY packages/shared packages/shared
COPY apps/api apps/api
COPY config config
COPY content content
COPY seed seed
COPY assets/brand assets/brand
COPY --from=fonts /app/assets/fonts assets/fonts
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8787 CHROME_PATH=/usr/bin/chromium WEB_DIST=/nonexistent
USER node
EXPOSE 8787
CMD ["apps/api/node_modules/.bin/tsx", "apps/api/src/server.ts"]
