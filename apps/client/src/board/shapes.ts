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
 * Der Metropolenaufsatz je Bereich, im Raster von `VIEWBOX`.
 *
 * Er sitzt **ueber** dem Dach: die Stadt reicht bis zu ihrem First bei
 * y -8 (dem Punkt `-3 -8` in `CITY_PATH`), und jeder Aufsatz bleibt darueber,
 * also bei y kleiner als -8 - der einzige freie Streifen im Raster, zwischen
 * dem First und dem oberen Rand der `VIEWBOX` bei y -9. Zentriert ist er auf
 * denselben Punkt `-3`, an dem das Dach seine Spitze hat, nicht auf den
 * Nullpunkt: er kroent den First und nicht die Mitte der Gruppe.
 *
 * Farbe traegt nur den Bereich, nicht die Form (Designregel 7) - wer die drei
 * Farben nicht auseinanderhaelt, muss die drei Umrisse auseinanderhalten. Die
 * Waage ist ein breiter, gerader Balken mit zwei Waagschalen an den Enden -
 * rechteckig und liegend. Die Krone ist ein Band mit drei spitzen Zacken,
 * die mittlere am hoechsten - ein Zickzack, keine Waagerechte. Die
 * Zahnrad-Sonne ist eine Nabe mit fuenf duennen Strahlen, die strahlenfoermig
 * auseinanderlaufen - ein Stern um einen Punkt, keine der beiden anderen
 * Formen hat eine Mitte, von der etwas ausgeht.
 */
export const METROPOLIS_PATHS: Readonly<Record<TrackId, string>> = {
  /**
   * Handel: die Waage. Balken und zwei Waagschalen, symmetrisch um den First -
   * eine liegende, rechteckige Form ohne Zacken und ohne Mittelpunkt, an dem
   * mehrere Linien zusammenlaufen.
   */
  trade:
    'M -3.25 -8.05 L -3.25 -8.55 L -2.75 -8.55 L -2.75 -8.05 Z ' +
    'M -7.8 -8.55 L -7.8 -8.75 L 1.8 -8.75 L 1.8 -8.55 Z ' +
    'M -3.15 -8.75 L -2.85 -8.75 L -3 -9 Z ' +
    'M -8.6 -8.55 L -7 -8.55 L -7.3 -8.05 L -8.3 -8.05 Z ' +
    'M 1 -8.55 L 2.6 -8.55 L 2.3 -8.05 L 1.3 -8.05 Z',
  /**
   * Politik: die Krone. Ein Band mit drei Zacken, die mittlere am hoechsten -
   * ein Zickzack ueber einer geraden Kante, ohne Waagschalen und ohne
   * ausstrahlende Spitzen.
   */
  politics:
    'M -7 -8.05 L -7 -8.3 L 1 -8.3 L 1 -8.05 Z ' +
    'M -6.3 -8.3 L -4.7 -8.3 L -5.5 -8.75 Z ' +
    'M -3.8 -8.3 L -2.2 -8.3 L -3 -9 Z ' +
    'M -1.3 -8.3 L 0.3 -8.3 L -0.5 -8.75 Z',
  /**
   * Wissenschaft: die Zahnrad-Sonne. Eine kleine Nabe mit fuenf duennen
   * Strahlen, die von ihr ausgehen wie ein Stern - der First traegt keine
   * andere Form, aus der mehrere Linien strahlenfoermig auseinanderlaufen.
   */
  science:
    'M -3 -8.15 L -2.65 -8.5 L -3 -8.85 L -3.35 -8.5 Z ' +
    'M -3.35 -8.4 L -3.35 -8.6 L -8.6 -8.25 Z ' +
    'M -3.15 -8.65 L -3.35 -8.55 L -5.6 -8.85 Z ' +
    'M -3.15 -8.75 L -2.85 -8.75 L -3 -9 Z ' +
    'M -2.85 -8.65 L -2.65 -8.55 L -0.4 -8.85 Z ' +
    'M -2.65 -8.4 L -2.65 -8.6 L 2.6 -8.25 Z',
};
