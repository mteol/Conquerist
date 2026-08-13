# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Bau-Stufe
#
# Debian statt Alpine: better-sqlite3 ist ein natives Modul und wird gegen
# glibc vorgebaut ausgeliefert. Auf musl gaebe es keine passende Binary, und
# jeder Build muesste sie uebersetzen - oder scheiterte an der fehlenden
# Toolchain.
# ---------------------------------------------------------------------------
FROM node:24-bookworm-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

WORKDIR /app

# Zuerst nur die Manifeste: so ueberlebt der Abhaengigkeits-Layer jede
# Codeaenderung im Cache. .npmrc muss mit - darin steht die Freigabe fuer die
# Build-Skripte von better-sqlite3 und esbuild, ohne die das native Modul
# fehlt und Vite nicht laeuft.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/client/package.json apps/client/

RUN pnpm install --frozen-lockfile

COPY . .

# Laeuft per Topologie in der richtigen Folge: shared, dann Client und Server.
RUN pnpm build

# Die Produktionsabhaengigkeiten fuer den Server allein, samt
# @conquerist/shared und dessen dist.
RUN pnpm --filter @conquerist/server --prod deploy --legacy /deploy

# ---------------------------------------------------------------------------
# Laufzeit-Stufe
# ---------------------------------------------------------------------------
FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

# Die Anordnung ist Pflicht, nicht Geschmack: static.ts sucht den Client ueber
# resolve(<server>/dist, '../../client/dist'). Liegt er woanders, startet der
# Server ohne Fehler und liefert still nur die API aus.
COPY --from=build /deploy/node_modules ./apps/server/node_modules
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/server/package.json ./apps/server/package.json
COPY --from=build /app/apps/client/dist ./apps/client/dist

# Das Volume kommt spaeter nach /data. Der Ordner gehoert `node`, damit ein
# frisch angelegtes Docker-Volume diese Rechte beim ersten Einhaengen erbt.
RUN mkdir -p /data && chown -R node:node /data /app
USER node

ENV HOST=0.0.0.0
ENV PORT=8080
ENV DATABASE_FILE=/data/conquerist.db
EXPOSE 8080

# Das slim-Image hat weder curl noch wget - also mit Bordmitteln.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Exec-Form: node ist PID 1 und bekommt SIGTERM, also greift das Herunterfahren
# aus server.ts (Wecker abraeumen, Verbindungen schliessen, App schliessen).
# Kein tini noetig, der Prozess startet keine Kinder.
CMD ["node", "apps/server/dist/server.js"]
