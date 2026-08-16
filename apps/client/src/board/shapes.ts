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
