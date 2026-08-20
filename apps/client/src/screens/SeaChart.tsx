import { useMemo, type JSX } from 'react';

/**
 * Die See unter dem Brett - eine Seekarte und keine Flaeche.
 *
 * **Warum es sie gibt.** Der Spielbildschirm gibt dem Brett die Hoehe und
 * schiebt die Ablagen in die zwei unteren Ecken; was dabei entsteht, sind
 * links und rechts Streifen von je mindestens 236 px, dazu der Rand oben. Das
 * ist zusammen der groesste Anteil des Bildschirms, und dort stand bisher ein
 * Radialverlauf - so gleichmaessig, dass man an einer Stelle sogar die Kante
 * zwischen zwei Stufen sah. Eine leere Flaeche, die ein Drittel des Bildes
 * belegt, macht auch ein gutes Brett brav.
 *
 * **Was hier liegt, ist nicht Zierat, sondern das Material des Spiels.** Auf
 * dem Brett liegen Haefen, an denen man tauscht, und um es herum liegt Wasser.
 * Eine Seekarte des 14. Jahrhunderts hat genau ein Kennzeichen, an dem man sie
 * ohne jede Bildunterschrift erkennt: das Netz der Kompasslinien. Von einer
 * Handvoll Knoten laufen Strahlen in **immer denselben** sechzehn Richtungen
 * durchs Bild - das ist der Punkt an einer Rhumbenlinie, sie haelt ihre
 * Peilung. Weil alle Knoten dieselben Richtungen benutzen, verzahnt sich das
 * Netz, statt sternfoermig zu zerfallen.
 *
 * **Der Hauptknoten liegt in der Mitte, also unter dem Brett.** Das ist die
 * Entscheidung, die aus einer Grafik eine Karte macht: die Linien kommen nicht
 * irgendwoher, sie kommen unter der Insel hervor. Sichtbar ist davon nur, was
 * neben dem Brett liegt - und genau das ist die Flaeche, um die es geht.
 *
 * **Es bewegt sich nichts.** Regel 5: Bewegung erklaert einen Zustandswechsel
 * oder entfaellt. Die See wechselt keinen Zustand. Sie driftet nicht, atmet
 * nicht und folgt keinem Zeiger.
 *
 * Die Deutlichkeit steht im Blatt (`.sea-chart`) und ist dort sehr leise
 * gehalten - Regel 4, das Brett ist der Held. Was hier passiert, soll man beim
 * zweiten Hinsehen bemerken und nicht beim ersten.
 */

/** Wie viele Peilungen das Netz kennt. Sechzehn ist die Rose der Portolane. */
const BEARINGS = 16;

/**
 * Wie viele Nebenknoten auf dem Ring sitzen, und wie weit draussen.
 *
 * Acht und nicht sechzehn: die Vorlage traegt sechzehn, aber die Vorlage ist
 * auch das ganze Blatt und hat kein Brett in der Mitte. Bei sechzehn Knoten
 * wird aus dem Netz ein Gewebe, und ein Gewebe traegt Textur - dann streitet
 * die See mit dem Gelaende darauf.
 */
const NODES = 8;
const RING = 0.66;

/**
 * Wie weit eine Linie laeuft.
 *
 * Grosszuegig ueber den Rand hinaus: das Bild wird mit `slice` gefuellt, und
 * auf einem breiten Fenster reicht die kurze Achse nicht bis in die Ecken.
 * Eine Linie, die vorher aufhoert, sieht aus wie ein Fehler im Blatt.
 */
const REACH = 3.2;

interface Line {
  readonly key: string;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

/**
 * Die Knoten: einer in der Mitte, acht auf dem Ring.
 *
 * Der Ring ist um eine halbe Teilung gedreht (`+ 0.5`), damit kein Nebenknoten
 * genau auf einer Peilung des Hauptknotens sitzt. Taete er das, laege er auf
 * einer Linie, die ohnehin durch ihn hindurchlaeuft, und seine eigenen
 * Strahlen faenden dort keinen Platz - aus dem Netz wuerde an acht Stellen ein
 * verdickter Strich.
 */
function nodesOf(): readonly { readonly x: number; readonly y: number }[] {
  const ring = Array.from({ length: NODES }, (_unused, index) => {
    const turn = ((index + 0.5) / NODES) * Math.PI * 2;
    return { x: Math.cos(turn) * RING, y: Math.sin(turn) * RING };
  });

  return [{ x: 0, y: 0 }, ...ring];
}

/**
 * Aus jedem Knoten eine Linie je Peilung.
 *
 * Acht Linien und nicht sechzehn: eine Gerade traegt zwei entgegengesetzte
 * Peilungen auf einmal. Sechzehn zu zeichnen hiesse, jede Linie doppelt zu
 * legen - unsichtbar, solange sie undurchsichtig waere, aber sie ist es
 * gerade nicht: zwei Striche mit je 5 % ergeben zusammen 10 %, und das Netz
 * waere doppelt so laut wie im Blatt beschrieben.
 */
function linesOf(): readonly Line[] {
  const lines: Line[] = [];

  nodesOf().forEach((node, nodeIndex) => {
    for (let bearing = 0; bearing < BEARINGS / 2; bearing += 1) {
      const turn = (bearing / BEARINGS) * Math.PI * 2;
      const dx = Math.cos(turn) * REACH;
      const dy = Math.sin(turn) * REACH;

      lines.push({
        key: `${nodeIndex}-${bearing}`,
        x1: node.x - dx,
        y1: node.y - dy,
        x2: node.x + dx,
        y2: node.y + dy,
      });
    }
  });

  return lines;
}

export function SeaChart(): JSX.Element {
  const lines = useMemo(linesOf, []);

  return (
    <svg
      className="sea-chart"
      viewBox="-1 -1 2 2"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      {lines.map((line) => (
        <line key={line.key} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} />
      ))}

      {/*
       * Der Ring, auf dem die Nebenknoten sitzen.
       *
       * Er ist die Konstruktionslinie der Rose und in einem Portolan wirklich
       * gezogen. Ohne ihn liest man acht Sterne; mit ihm liest man eine Rose,
       * und das ist der Unterschied zwischen einem Muster und einer Karte.
       */}
      <circle className="sea-chart__rose" cx="0" cy="0" r={RING} />
    </svg>
  );
}
