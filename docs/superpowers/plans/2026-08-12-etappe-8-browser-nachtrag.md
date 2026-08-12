# Etappe 8 — Browser-Nachtrag

> Uebergabe an eine neue Sitzung. Der Handel ist gebaut, abgenommen und
> committet; **zwei Bilder fehlen** im Browser-Durchlauf. Diese Datei sagt, was
> fehlt, wie man hinkommt, und welche Fallen dabei schon zugeschnappt sind.

**Stand:** Branch `etappe-4-online`, letzter Commit `1df2b26`. Working Tree
sauber. 891 Tests gruen (shared 568, server 121, client 202).

## Was noch fehlt

Nur Augenschein, kein Verhalten — das ist am laufenden Server und im Browser
belegt (siehe `PROGRESS.md`, Abschnitte „Am laufenden Server durchgespielt" und
„Im Browser gesehen").

1. **Die Antwortliste des Anbieters** mit je Zusage einem Knopf
   „Mit … tauschen" — und der Zuschlag selbst.
2. **Das Gegenangebot-Formular** im Angebotsdialog (Knopf „Gegenangebot" →
   dieselbe Mengenauswahl → „Gegenangebot abschicken").
3. **Das schmale Fenster**: Angebotsdialog und Handelsfenster bei ~360 px
   Breite bedienbar, nichts abgeschnitten.

Beides ist durch Komponententests gedeckt
(`apps/client/src/dialogs/tradeOffer.test.tsx`, `dialogs.test.tsx`) — es ist
nicht ungeprueft, nur ungesehen.

**Warum es beim ersten Mal nicht klappte:** dreimal lief die 60-Sekunden-Frist
ab, bevor ein Mitspieler antworten konnte. Zweimal fehlte ihm der verlangte
Rohstoff (Annehmen zu Recht gesperrt), einmal fror der Tab ein. Der Ablauf muss
also **zuegig** sein und die richtige Ressource verlangen.

## Aufbau, der funktioniert hat

Drei Spieler brauchen drei **Origins** — gleicher Origin heisst gleicher
`localStorage` heisst dieselbe Identitaet.

| Tab                   | URL                                | woher der Client kommt           |
| --------------------- | ---------------------------------- | -------------------------------- |
| 1 (Anna, Gastgeberin) | `http://localhost:5173/`           | Vite-Dev                         |
| 2                     | `http://127.0.0.1:8080/?raum=CODE` | vom Server ausgeliefertes `dist` |
| 3                     | `http://localhost:8080/?raum=CODE` | dasselbe `dist`, anderer Origin  |

Beide 8080-Tabs brauchen ein aktuelles `dist`: **vorher `pnpm build` laufen
lassen**, sonst zeigen sie einen alten Client.

```bash
pnpm build                                  # sonst ist das dist der 8080-Tabs alt
cd apps/server && DATABASE_FILE=./data/browsercheck.db pnpm dev   # eigene DB!
cd apps/client && pnpm dev
```

**Die eigene Datenbankdatei ist Absicht** — `data/conquerist.db` bleibt
unberuehrt. Am Ende `apps/server/data/browsercheck.db*` loeschen.

## Fallen, die schon zugeschnappt sind

- **Keine Skripte nach `apps/server/` schreiben.** `tsx watch` startet den
  Server neu und wirft alle Verbindungen weg. Hilfsskripte gehoeren in den
  Scratchpad; `ws` von dort per
  `import { WebSocket } from 'file:///C:/code/Conquerist/node_modules/.pnpm/ws@8.21.1/node_modules/ws/wrapper.mjs'`.
- **Ein Screenshot eines Hintergrund-Tabs sieht halbdurchsichtig aus.** Das ist
  ein Artefakt der Aufnahme, kein CSS-Fehler: `getComputedStyle(box).opacity`
  war `1` und die Eingangsanimation `finished`, waehrend
  `document.visibilityState === 'hidden'`. Nicht als Fehler melden — erst im
  Vordergrund-Tab nachsehen.
- **Tab-Ids aendern sich beim Neuladen.** Nach jedem Reload
  `tabs_context_mcp` neu lesen.
- **Das `find`-Werkzeug laeuft ins Modell-Limit.** Guenstiger: Knoepfe per
  `javascript_tool` ueber ihren Text oder ihr `aria-label` klicken.
- **Brett-Klicks per Koordinate treffen die Kanten kaum.** Die Ziele haben
  eigene Klassen:
  - Siedlung: `.vertex__target` — klicken auf den `.vertex__hit` **im selben
    Elternelement** (nicht `closest('g')`, das greift zu weit).
  - Strasse: `.road--target` — direkt klicken.
- **Gruendungsphase abkuerzen** mit diesem Helfer (je Tab einmal setzen, dann
  `await window.__tap()` je Setzung; Reihenfolge Schlange: 1,2,3,3,2,1):

```js
window.__tap = async () => {
  const svg = document.querySelector('svg');
  const road = svg.querySelector('.road--target');
  const vertexMark = svg.querySelector('.vertex__target');
  let el = null;
  if (road) el = road;
  else if (vertexMark) el = vertexMark.parentElement?.querySelector('.vertex__hit') ?? vertexMark;
  if (!el) return 'kein Ziel';
  const r = el.getBoundingClientRect();
  el.dispatchEvent(
    new MouseEvent('click', {
      bubbles: true,
      clientX: r.x + r.width / 2,
      clientY: r.y + r.height / 2,
    }),
  );
  await new Promise((res) => setTimeout(res, 450));
  return (
    document.body.textContent.match(/Gruendung:[^R]*|ist am Zug|muss wuerfeln/)?.[0]?.trim() ??
    'weiter'
  );
};
```

## Der Ablauf, der zum Ziel fuehrt

1. Raum anlegen (Tab 1), beitreten (Tab 2 und 3 ueber `?raum=CODE`), starten.
2. Gruendung mit `__tap` durchspielen, dann in Tab 1 wuerfeln.
3. **Erst nachsehen, wer was hat**, bevor ein Angebot rausgeht. Die eigene Hand
   steht in „DEINE KARTEN"; was die anderen haben, sieht man in deren Tab
   (`document.body.textContent` reicht). Der Anbieter muss etwas verlangen, das
   ein Mitspieler **wirklich haelt** — sonst ist „Annehmen" zu Recht gesperrt
   und die Frist laeuft ins Leere.
4. Angebot legen (Tab 1): Handel → Reiter „Spieler" → je ein `+` auf beiden
   Seiten → „Angebot auf den Tisch legen".
5. **Bild 2 zuerst**, es ist das fluechtigere: in Tab 2 „Gegenangebot" klicken,
   Mengen setzen (nicht dieselbe Sorte auf beiden Seiten — der Knopf bleibt
   sonst zu Recht gesperrt), Screenshot vom Formular, abschicken.
6. **Bild 1**: zurueck in Tab 1 — dort steht jetzt die Antwortliste mit
   „⇄ … bietet …" und dem Knopf „Mit … tauschen". Screenshot, dann klicken und
   den Kartenwechsel im Tisch-Panel bestaetigen.
7. **Bild 3**: Fenster auf ~360 px verschmalern (`resize_window`) und
   Angebotsdialog plus Handelsfenster ansehen.

Schnell bleiben: ab Schritt 4 laeuft die Uhr, und jedes Gegenangebot setzt sie
neu (`tradeOfferMs` = 60 000 im `CLASSIC_RULES`). Wer mehr Luft braucht, setzt
den Wert voruebergehend hoch — **aber nicht committen**.

## Zum Schluss

- `apps/server/data/browsercheck.db*` loeschen, beide Dev-Server stoppen
  (unter Windows haelt der `tsx`-Kindprozess den Port; notfalls ueber
  `Get-NetTCPConnection -LocalPort 8080` die PID holen und beenden).
- In `PROGRESS.md` den offenen Punkt „Vom Browser-Durchlauf fehlen noch zwei
  Bilder" ersetzen durch das, was gesehen wurde — und diese Datei loeschen.
- `pnpm typecheck && pnpm test && pnpm format:check` vor dem Commit.

## Fehler nicht suchen, wo keine sind

Zwei Dinge wurden im ersten Durchlauf gefunden und sind **bereits behoben**:

- `ActionPanel`: der Handelsknopf hing allein an den Bankgeschaeften
  (`99c7aea`).
- `useOnlineGame`: `createRoom`/`joinRoom` meldeten sich ohne Geheimnis neu an
  und wechselten damit still die Identitaet (`aa87a8e`, Fehler aus Etappe 5).

Wer sie noch einmal sieht, hat einen alten Stand ausgecheckt.
