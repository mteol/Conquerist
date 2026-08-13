# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Bau-Stufe
#
# Debian statt Alpine: better-sqlite3 ist ein natives Modul, und fuer Node 24
# auf linux/x64 gibt es davon keine vorgebaute Binary - es wird uebersetzt.
# Auf glibc geht das ohne Zusatzarbeit, auf musl nicht.
#
# Der erste Build hat genau daran gehangen ("gyp ERR! find Python"): das
# slim-Image bringt keinen Compiler mit. Die Werkzeuge stehen deshalb hier und
# nur hier - die Laufzeitstufe bekommt die fertige .node-Datei und bleibt ohne
# Toolchain.
# ---------------------------------------------------------------------------
FROM node:24-bookworm-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

# Vor dem Kopieren der Manifeste: diese Schicht aendert sich nie und bleibt
# damit ueber jeden weiteren Build im Cache.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

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
#
# Das Ziel ist /out/apps/server und NICHT irgendein Ordner, der spaeter
# umbenannt wird: pnpm legt @conquerist/shared als Symlink in den virtuellen
# Store unterhalb des Zielordners. Wer diesen Ordner im Laufzeit-Image an eine
# andere Stelle kopiert, bekommt einen toten Link - und Node sagt dazu nur
# "Cannot find package '@conquerist/shared'". Genau daran ist der zweite
# Deployment-Versuch gestorben. Also heisst der Pfad hier schon so, wie er
# drueben heissen wird.
RUN pnpm --filter @conquerist/server --prod deploy --legacy /out/apps/server

# Der gebaute Client daneben - dieselbe Anordnung wie im Repository, weil
# static.ts ihn relativ zum Server-dist sucht.
RUN mkdir -p /out/apps/client && cp -r /app/apps/client/dist /out/apps/client/dist

# Der Beweis, dass die Aufloesung traegt, BEVOR ein Container damit startet.
# Schlaegt sie fehl, faellt der Build mit einer lesbaren Zeile um, statt dass
# spaeter ein Container im Sekundentakt neu startet.
RUN cd /out/apps/server && node --input-type=module -e "\
import('@conquerist/shared') \
  .then((m) => console.log('shared aufloesbar,', Object.keys(m).length, 'Exporte')) \
  .catch((error) => { console.error(error.message); process.exit(1); })"

# ---------------------------------------------------------------------------
# Laufzeit-Stufe
# ---------------------------------------------------------------------------
FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /out

# Ein einziges COPY, und der Pfad bleibt derselbe wie in der Bau-Stufe. Genau
# darauf beruht, dass die Symlinks in node_modules noch zeigen, wohin sie
# sollen. Die Anordnung darin ist die des Repositorys: apps/server/dist neben
# apps/client/dist, weil static.ts den Client relativ zum Server-dist sucht.
#
# Die Eigentuemerschaft steht am COPY und nicht in einem chown danach: ein
# `chown -R` schriebe jede kopierte Datei ein zweites Mal in eine neue Schicht
# und verdoppelte damit den Platzbedarf des groessten Teils im Image.
COPY --from=build --chown=node:node /out /out

# Das Volume kommt spaeter nach /data. Der Ordner gehoert `node`, damit ein
# frisch angelegtes Docker-Volume diese Rechte beim ersten Einhaengen erbt.
RUN mkdir -p /data && chown node:node /data
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
