import type { TrackId } from '@conquerist/shared';

/**
 * Die Silhouetten der Bauwerke - an einem Ort, weil sie an drei Orten stehen.
 *
 * Auf dem Brett, im Wartebereich (die Sitzfarbe) und in der Vorratsanzeige. Wer
 * unten in seinem Vorrat eine Stadt sieht, soll sie oben auf dem Brett
 * wiedererkennen; drei Zeichnungen fuer dasselbe Bauwerk waeren drei
 * Gelegenheiten, dass eine davon abweicht.
 *
 * **Warum die Stadt keine groessere Siedlung ist.** Bis zum ersten Playtest war
 * sie genau das: derselbe Punkt, nur mit groesserem Radius. Groesse ist die
 * schwaechste Unterscheidung, die es gibt - man liest sie nur im Vergleich, und
 * zwei eigene Bauwerke stehen selten nebeneinander. Ein Haus und ein Haus mit
 * Anbau unterscheiden sich dagegen einzeln, auch klein und auch in Graustufen.
 *
 * Alle Pfade liegen im selben Raum: rund 20 Einheiten breit, um den Nullpunkt
 * herum. Wer sie aufs Brett bringt, verkleinert sie; wer sie in ein Panel
 * bringt, gibt ihnen `VIEWBOX`.
 */

/** Der Ausschnitt, in den alle drei Formen passen. */
export const VIEWBOX = '-10 -9 20 17';

/** Die Siedlung: ein Haus. */
export const SETTLEMENT_PATH = 'M -6 7 L -6 -1 L 0 -7 L 6 -1 L 6 7 Z';

/** Die Stadt: dasselbe Haus mit einem Anbau daneben. */
export const CITY_PATH = 'M -9 7 L -9 -2 L -3 -8 L 3 -2 L 3 7 Z M 3 7 L 3 0 L 9 0 L 9 7 Z';

/** Die Strasse: ein Balken. Sie wird gestrichen, nicht gefuellt. */
export const ROAD_PATH = 'M -7 5 L 7 -5';

/**
 * Der Ritter: Sockel, Rumpf, Kopf — ohne seine Fahne.
 *
 * **Die Stufe steht nicht in der Größe.** Sie steht in den Spitzen an der
 * Fahne (`KNIGHT_PENNANTS`), und zwar aus demselben Grund, aus dem die Stadt
 * kein größerer Punkt ist: Größe liest man nur im Vergleich, Spitzen kann man
 * zählen. Das Spiel macht es selbst so — „Die Stärke eines Ritters wird durch
 * die Anzahl der Spitzen an der Fahne dargestellt."
 *
 * Der Kopf ist eine Raute und kein Kreis. Wo diese Oberfläche rundet, sitzt
 * eine Schräge (Designregel 3) — dieselbe Handschrift wie die Fase an Knöpfen
 * und Ziffern.
 */
export const KNIGHT_PATH =
  'M -7 7 L -7 4.5 L 1.5 4.5 L 1.5 7 Z ' +
  'M -5.6 4.5 L -4.4 -1 L -0.6 -1 L 0.6 4.5 Z ' +
  'M -2.5 -6 L -0.3 -3.5 L -2.5 -1 L -4.7 -3.5 Z';

/** Der Mast, an dem die Spitzen sitzen. Er wird gestrichen, nicht gefüllt. */
export const KNIGHT_MAST_PATH = 'M 3 7 L 3 -8';

/**
 * Die Fahnenspitzen, von oben nach unten.
 *
 * Ein Ritter zeigt die ersten `level` davon: eine Spitze ist ein Einfacher,
 * zwei ein Starker, drei ein Mächtiger Ritter. Sie hängen deshalb an der Stufe
 * und nicht an einer eigenen Zahl — zwei Wahrheiten über dieselbe Stärke wären
 * eine zu viel.
 *
 * **Die Teilung ist nachgemessen und war einmal zu eng.** Sie standen mit
 * 2,6 Einheiten Höhe und 0,8 Einheiten Lücke da; im Browser gemessen ergab
 * das bei einer Bretteinheit von 94,2 px eine Lücke von **1,7 px** — gegen
 * eine Kontur von 2,4 px. Zwei benachbarte Spitzen berührten sich also mit
 * ihren Rändern, und drei davon wären ein Balken gewesen. Damit wäre genau
 * die Zusage gebrochen, für die es sie gibt: daß man sie **zählt**.
 *
 * Jetzt 2,0 hoch bei 3,6 Teilung, also 1,6 Einheiten Lücke. Die Kontur der
 * Spitzen ist im Blatt eigens dünner (siehe `.knight__pennant`).
 */
export const KNIGHT_PENNANTS: readonly string[] = [
  'M 3.4 -8 L 7.6 -7 L 3.4 -6 Z',
  'M 3.4 -4.4 L 7.6 -3.4 L 3.4 -2.4 Z',
  'M 3.4 -0.8 L 7.6 0.2 L 3.4 1.2 Z',
];

/**
 * Der Helm des aktivierten Ritters.
 *
 * **Aktiv und passiv unterscheidet ein Stück Material, keine Deckkraft.** Ein
 * halbdurchsichtiger Ritter liest sich als „gesperrt", nicht als „ruht" — und
 * ein ruhender Ritter ist nicht gesperrt, er wartet nur auf sein Getreide.
 */
export const KNIGHT_HELMET_PATH = 'M -5.4 -3.2 L -2.5 -7 L 0.4 -3.2 L -0.9 -1.9 L -4.1 -1.9 Z';

/**
 * Die Stadtmauer: ein Zinnenband **vor** der Stadt.
 *
 * Sie steht nicht darunter, obwohl sie im Spiel ein Sockel ist. Der Grund ist
 * Platz: die Stadtsilhouette endet bei y 7, und darunter liegt genau eine
 * Einheit. Ein Sockel wäre ein Strich gewesen. Vor der Stadt gezeichnet nimmt
 * das Band ihr das untere Drittel und läßt Dach und Giebel stehen — und genau
 * so sieht eine ummauerte Stadt aus.
 *
 * Die Zinnen sind gezählt und nicht angedeutet: vier Blöcke, drei Lücken. Eine
 * Stufung, die man nicht zählen kann, ist keine.
 */
export const WALL_PATH =
  'M -10 8 L -10 1.6 L -7.4 1.6 L -7.4 3.2 L -4.8 3.2 L -4.8 1.6 L -2.2 1.6 ' +
  'L -2.2 3.2 L 0.4 3.2 L 0.4 1.6 L 3 1.6 L 3 3.2 L 5.6 3.2 L 5.6 1.6 ' +
  'L 8.2 1.6 L 8.2 3.2 L 10 3.2 L 10 8 Z';

/**
 * Der Turm der Metropole, im Raster von `VIEWBOX` - hinter der Stadt gezeichnet.
 *
 * Der alte Aufsatz war ein Streifen von einer Einheit Hoehe ueber dem First,
 * auf dem Brett rund ein Pixel: niemand hat eine Metropole erkannt. Jetzt
 * waechst aus dem Haupthaus ein Turm mit drei Zinnen bis y -16, fast doppelt so
 * hoch wie die Stadt - die Silhouette allein sagt „Metropole", auch ohne Farbe.
 * Er steht auf demselben Punkt -3 wie der First, also mittig ueber dem Haus.
 */
export const METROPOLIS_TOWER_PATH =
  'M -6 0 L -6 -13 L -6.8 -13 L -6.8 -16 L -5 -16 L -5 -14.6 L -3.9 -14.6 L -3.9 -16 ' +
  'L -2.1 -16 L -2.1 -14.6 L -1 -14.6 L -1 -16 L 0.8 -16 L 0.8 -13 L 0 -13 L 0 0 Z';

/** Wo das Bereichszeichen am Turm sitzt - auf seinem Schaft, ueber dem First. */
export const METROPOLIS_EMBLEM_AT = { x: -3, y: -11.3 } as const;

/**
 * Das Bereichszeichen der Metropole, um den Nullpunkt, Radius rund 3.
 *
 * Farbe traegt den Bereich, die Form traegt ihn noch einmal (Designregel 7):
 * Handel ist eine Muenze mit Vierkantloch, Politik eine Krone mit drei
 * Zacken, Wissenschaft ein Zahnrad mit Nabe. Drei Umrisse, die sich auch bei
 * zehn Pixeln nicht gleichen - rund, gezackt nach oben, gezahnt rundum.
 * Loecher per `fill-rule: evenodd`.
 */
export const METROPOLIS_EMBLEMS: Readonly<Record<TrackId, string>> = {
  trade:
    'M 2.9 0 A 2.9 2.9 0 1 0 -2.9 0 A 2.9 2.9 0 1 0 2.9 0 Z ' +
    'M -0.85 -0.85 L 0.85 -0.85 L 0.85 0.85 L -0.85 0.85 Z',
  politics: 'M -3 2.1 L -3 -2.2 L -1.55 -0.3 L 0 -3 L 1.55 -0.3 L 3 -2.2 L 3 2.1 Z',
  science:
    'M -0.39 -2.97 L 0.39 -2.97 L 0.84 -2.03 L 1.34 -1.75 L 2.38 -1.83 L 2.77 -1.15 ' +
    'L 2.18 -0.29 L 2.18 0.29 L 2.77 1.15 L 2.38 1.83 L 1.34 1.75 L 0.84 2.03 L 0.39 2.97 ' +
    'L -0.39 2.97 L -0.84 2.03 L -1.34 1.75 L -2.38 1.83 L -2.77 1.15 L -2.18 0.29 ' +
    'L -2.18 -0.29 L -2.77 -1.15 L -2.38 -1.83 L -1.34 -1.75 L -0.84 -2.03 Z ' +
    'M 0.9 0 A 0.9 0.9 0 1 0 -0.9 0 A 0.9 0.9 0 1 0 0.9 0 Z',
};
