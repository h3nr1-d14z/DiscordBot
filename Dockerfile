FROM node:18-slim

# Runtime shared libraries for canvas (meme command) and curl-free healthchecks via node
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       libcairo2 libpango-1.0-0 libjpeg62-turbo libgif7 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

# Install all deps (typescript is a devDep) then build, then prune to production
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY public ./public
COPY scripts ./scripts
RUN npm run build

RUN rm -rf src/ && npm prune --omit=dev

RUN mkdir -p data logs

RUN addgroup --gid 1001 --system nodejs \
    && adduser --uid 1001 --system --ingroup nodejs nodejs \
    && chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 8736 3000

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
