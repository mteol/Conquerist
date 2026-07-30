/**
 * Deterministischer Pseudozufall als unveraenderlicher Wert.
 *
 * Regel 2 verlangt reine Logik: kein `Math.random()`, kein verstecktes
 * Innenleben. Deshalb ist der Zufallszustand hier ein gewoehnlicher Wert, den
 * der Aufrufer weiterfuehrt - `nextUint32(rng)` gibt `[wert, naechsterRng]`
 * zurueck und laesst das Argument unberuehrt. Umstaendlicher als `rng.next()`,
 * aber nur so laesst sich der Spielzustand ab Etappe 6 aus dem Action-Log
 * rekonstruieren: der Zustand ist Teil des Logs, nicht Teil eines Objekts.
 *
 * Algorithmus: `sfc32` (Small Fast Counting) mit `cyrb128` als Seed-Hash.
 * Ausschliesslich 32-Bit-Ganzzahloperationen ueber `Math.imul`, `|0`, `>>>` -
 * also bitgleich in Node und im Browser. Keine Fliesskommaakkumulation, die
 * zwischen Engines abweichen koennte. Server und Client muessen aus demselben
 * Seed dasselbe Brett bauen; das ist Voraussetzung, keine Bequemlichkeit.
 */

/**
 * Zustand des Generators: vier vorzeichenlose 32-Bit-Woerter.
 *
 * Bewusst ein schlichtes, JSON-taugliches Objekt - dieser Wert wandert ab
 * Etappe 6 unveraendert in Action-Log und SQLite.
 */
export interface Rng {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
}

/** Groesse des Wertebereichs: 2^32. */
const UINT32_RANGE = 0x100000000;

/**
 * Anzahl der Ziehungen, die direkt nach dem Seeden verworfen werden.
 *
 * sfc32 mischt seinen Zustand erst nach einigen Runden vollstaendig durch.
 * Ohne Vorlauf koennen aehnliche Seeds ("seed-a" / "seed-b") in den ersten
 * Werten korrelieren. Der Vorlauf ist fester Bestandteil des Verfahrens und
 * darf sich nicht mehr aendern - jede Aenderung erzeugt aus allen bestehenden
 * Seeds andere Bretter.
 */
const WARMUP_DRAWS = 12;

/**
 * Hasht einen Seed-String auf vier gut durchmischte 32-Bit-Woerter (cyrb128).
 *
 * Der Seed ist ein String, weil sich aus `"conquerist-42"` ein teilbarer
 * Spielcode machen laesst; eine Zahl koennte das nicht besser und liest sich
 * schlechter.
 */
function hashSeed(seed: string): Rng {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;

  for (let i = 0; i < seed.length; i += 1) {
    const k = seed.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }

  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);

  return {
    a: (h1 ^ h2 ^ h3 ^ h4) >>> 0,
    b: (h2 ^ h1) >>> 0,
    c: (h3 ^ h1) >>> 0,
    d: (h4 ^ h1) >>> 0,
  };
}

/** Erzeugt den Startzustand zu einem Seed. Gleicher Seed, gleicher Zustand - immer. */
export function createRng(seed: string): Rng {
  let rng = hashSeed(seed);
  for (let i = 0; i < WARMUP_DRAWS; i += 1) {
    [, rng] = nextUint32(rng);
  }
  return rng;
}

/**
 * Zieht eine vorzeichenlose 32-Bit-Ganzzahl und gibt den Folgezustand zurueck.
 *
 * Der uebergebene Zustand wird nicht veraendert; zweimal mit demselben `rng`
 * aufgerufen liefert zweimal dasselbe Ergebnis.
 */
export function nextUint32(rng: Rng): readonly [value: number, next: Rng] {
  const { a, b, c, d } = rng;

  const t = (((a + b) | 0) + d) | 0;

  return [
    t >>> 0,
    {
      a: (b ^ (b >>> 9)) >>> 0,
      b: ((c + (c << 3)) | 0) >>> 0,
      c: ((((c << 21) | (c >>> 11)) + t) | 0) >>> 0,
      d: ((d + 1) | 0) >>> 0,
    },
  ];
}

/** Zieht eine Fliesskommazahl in `[0, 1)`. Nur fuer Anzeige und Statistik gedacht. */
export function nextFloat(rng: Rng): readonly [value: number, next: Rng] {
  const [value, next] = nextUint32(rng);
  return [value / UINT32_RANGE, next];
}

/**
 * Zieht eine Ganzzahl in `[0, boundExclusive)` - ohne Modulo-Verzerrung.
 *
 * Naives `wert % bound` bevorzugt die kleinen Zahlen, weil 2^32 durch die
 * wenigsten Obergrenzen glatt teilbar ist. Bei einem Wuerfel faellt das nicht
 * auf, beim Mischen von 19 Gelaendeplaettchen schon. Deshalb Rejection
 * Sampling: alles oberhalb des groessten Vielfachen von `bound` wird verworfen
 * und neu gezogen. Bleibt deterministisch, weil die Verwerfungen aus demselben
 * Zustand immer an denselben Stellen auftreten.
 */
export function nextInt(rng: Rng, boundExclusive: number): readonly [value: number, next: Rng] {
  if (!Number.isInteger(boundExclusive) || boundExclusive < 1) {
    throw new RangeError(
      `nextInt: boundExclusive muss eine ganze Zahl >= 1 sein, war ${boundExclusive}`,
    );
  }

  // Bei genau einer Moeglichkeit gibt es nichts zu entscheiden. Kein Zufall
  // verbraucht - sonst haengt die Folge davon ab, wie oft jemand eine
  // einelementige Auswahl "gewuerfelt" hat.
  if (boundExclusive === 1) return [0, rng];

  const limit = UINT32_RANGE - (UINT32_RANGE % boundExclusive);

  let current = rng;
  for (;;) {
    const [value, next] = nextUint32(current);
    current = next;
    if (value < limit) return [value % boundExclusive, current];
  }
}
