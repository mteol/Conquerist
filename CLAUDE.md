# Projekt: conquerist

Multiplayer-Brettspiel (Catan-artig), rundenbasiert, Web.
Zwei Entwickler, Lernprojekt mit Anspruch auf saubere Architektur.

## Stack
pnpm-Monorepo · TypeScript strict · React 19 + Vite (SVG-Rendering)
Fastify 5 + Raw WebSocket (`ws`) · SQLite (better-sqlite3) · Vitest
Deployment später: Docker auf Coolify

## Struktur
- `packages/shared` — Spiellogik, Typen, Protokoll. **Reines TypeScript.**
- `apps/server` — WebSocket-Server, Autorität über den Spielzustand
- `apps/client` — React-Frontend

Paket-Scope: `@conquerist/shared`, `@conquerist/server`, `@conquerist/client`

## Unverhandelbare Architekturregeln

1. **`shared` hat keine Runtime-Dependencies außer `zod`.**
   Kein React, kein Node-API, kein Framework. Muss im Browser UND in Node laufen.

2. **Spiellogik ist pur.** `(state, action) => newState`.
   Keine Seiteneffekte, kein I/O, kein Math.random(), kein Date.now().
   Zufall ausschließlich über einen übergebenen Seed.
   Grund: Server validiert, Client sagt Züge voraus, Tests laufen ohne
   Infrastruktur, und der Zustand ist aus dem Action-Log rekonstruierbar.

3. **Der Server ist die Autorität.** Der Client schickt Absichten, keine
   Ergebnisse. Jede eingehende Nachricht wird per Zod validiert, BEVOR sie
   die Logik erreicht.

4. **Verdeckte Information.** Handkarten sind geheim. Es gibt GameState
   (Server) und PlayerView (was ein einzelner Spieler sehen darf).
   Niemals den vollen State an Clients senden.

5. **Erweiterbarkeit ohne Vorbau.** Zuerst das Basisspiel, aber:
   - Board datengetrieben (ScenarioDefinition), nie hartkodiert
   - Actions als Discriminated Union
   - Regelwerte (Baukosten, Siegpunktziel, Stapelgroessen) in einem RuleSet
   - Ressourcen/Bauteile als Record<Id, number>, nicht als feste Felder
   Kein Plugin-System, keine Abstraktion "fuer spaeter" ohne konkreten Bedarf.

6. **Netzwerkprotokoll:** Envelope mit Korrelations-ID
   ({ id, type, payload } -> { replyTo, ok, error?, payload? }).
   Heartbeat serverseitig. Jeder Broadcast traegt eine hochzaehlende version.

7. **Identität ab Tag 1.** Jeder Spieler ist ein Eintrag in `users`, auch Gäste
   (`is_guest = true`, ohne Zugangsdaten). Spiele referenzieren immer eine
   `user_id`, nie einen losen Namensstring. Registrierung ist später ein
   UPDATE auf die bestehende Zeile, kein neuer Datentyp.

## Arbeitsweise
- In klar abgegrenzten Etappen. Nicht vorgreifen, nichts "schon mal mitmachen".
- Vollständige Dateien, keine Ausschnitte.
- Entscheidungen kurz begründen — das Warum, nicht nur das Was.
- Bei Unklarheit nachfragen statt raten.
- Neue Logik in shared bekommt Tests.
- Antworten auf Deutsch, Code und Bezeichner auf Englisch.
- **Design ist Abnahmekriterium, nicht Nacharbeit.** Siehe unten.
- **`PROGRESS.md` wird ohne Aufforderung fortgeschrieben.** Siehe unten.

## Sparsam arbeiten (Zeit und Tokens)
- **Nur lesen, was die Aufgabe braucht.** `docs/archiv/`, alte Pläne und Specs
  nie ganz lesen — gezielt per Suche nach Stichwort.
- **Pläne beschreiben, statt Code vorzuschreiben:** Ziel, betroffene Dateien,
  Testfälle, Schnittstellen. Kein fertiger Code im Plan; ein Plan über ~30 KB
  ist zu lang.
- **Subagenten nur, wo es sich lohnt.** Mechanische oder kleine Aufgaben direkt
  erledigen. Umsetzende Subagenten mit `model: sonnet`. Getrennte Spec- und
  Qualitätsreviews je Aufgabe nur bei riskanter Logik (Reducer, Geheimhaltung,
  Protokoll); sonst **ein** Review am Ende der Etappe.
- **Tests gezielt:** während einer Aufgabe nur die betroffenen Dateien
  (`pnpm --filter @conquerist/shared exec vitest run <dateiname>`, z. B. `draw`); die volle Abnahme
  (`pnpm typecheck && pnpm -r test && pnpm build && pnpm format:check`) einmal
  am Ende einer Etappe bzw. vor dem Commit, der sie abschließt.
- Lange Ausgaben kürzen (`| tail -30`), nicht komplett in den Verlauf holen.

## Design
Die ausführlichen Regeln und die Liste der Fallen stehen in **`docs/design.md`
— vor jeder Arbeit an der Oberfläche lesen.** Kurzfassung:
1. Erst der Entwurf (Rolle, Aufbau, das eine Element), dann das Markup.
2. Farbwelt steht: Tiefsee-Tinte, Pergament, Geländefarben. Kein Hex-Wert in
   Komponenten — nur Variablen aus `index.css`.
3. Kein Webfont; überall Tabellenziffern. Gezeichnete Anzeigeschrift
   (`Wordmark.tsx`, `Numerals.tsx`) auf einem Raster. Fase per
   `corner-shape: bevel`, nie `clip-path`; Spielmaterial wird nicht geschnitten.
4. Das Brett ist der Held.
5. Bewegung erklärt einen Zustandswechsel oder entfällt; `prefers-reduced-motion`
   kürzt auch Verzögerungen.
6. Struktur codiert Inhalt.
7. Bedienbar bis zum schmalen Handy, sichtbarer Fokus, Kontrast, Farbe nie
   einziger Informationsträger.
8. Texte sind Designmaterial: aktiv, ein Wort für eine Sache.

## Etappenplan
0–9 ✅ (Grundgerüst, shared, Hotseat, Server, Client-Anbindung, Persistenz,
Auth, Handel/Entwicklungskarten, Docker/Coolify). 10 Erweiterungen (Städte &
Ritter): 10a–10d-2 ✅, Stand und nächste Etappe in `PROGRESS.md`.

## Landmarken
- Regeln in `shared/game` je eigene Datei als `can…`/`apply…`; `legalActions`
  benutzt dieselben `can…` — nur eine Auslegung.
- **Der Client kennt keine Regel.** Er bekommt eine Aktionsliste und schickt die
  gefundene Aktion; `GameScreen` bedient lokal und online mit `PlayerView` +
  Aktionsliste.
- Zeit: der Server stempelt `at`, der Reducer liest nie eine Uhr; Fristen über
  `deadlineOf` und den Wecker `apps/server/src/rooms/clock.ts`.
- Migrationen (`MIGRATIONS` in `apps/server/src/db/database.ts`) werden nie
  nachträglich geändert, nur angehängt.
- Ausführliche Landkarte des Codes: `docs/architektur.md`.

## Die Standsdatei wird mitgeschrieben, nicht nachgereicht
**`PROGRESS.md` gehört zu jeder Arbeit, die etwas verändert** und wird mit
committet. Sie bleibt **kurz** (Stand, offene Punkte, nächste Etappe, laufende
Etappe). Ist eine Etappe abgeschlossen, wandert ihr voller Abschnitt nach
`docs/archiv/` (vorhandene Datei ergänzen oder neue anlegen) und in
`PROGRESS.md` bleibt eine Zeile plus die noch offenen Punkte.

Form eines Abschnitts, knapp gehalten:
- **Überschrift und Stand** — was, wann, Branch, Commits.
- **Abnahme** — typecheck, Tests je Paket, Build mit Bundlegröße,
  format:check. **Gemessen, nicht geschätzt.**
- **Getroffene Entscheidungen** — je eine, fett, mit Grund (das ist der Wert der
  Datei).
- **Abweichungen vom Plan**, **Offene Punkte** (auch bewusste
  Regelabweichungen), **Nächste Etappe**.
