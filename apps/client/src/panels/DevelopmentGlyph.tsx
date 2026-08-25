import type { JSX } from 'react';
import type { DevelopmentCardId } from '@conquerist/shared';

/**
 * Das Motiv einer Entwicklungskarte.
 *
 * **Dieselbe Handschrift wie `ResourceGlyph`, und das ist der ganze Punkt.**
 * Gleiches Quadrat (24x24), gleiche Kantenrundung, einfarbig dunkel gefuellt,
 * Aussparungen als Loch statt als heller Strich. Wer beide Reihen
 * uebereinander sieht, soll zwei Sorten Karten erkennen und **einen** Zeichner.
 * Ein Satz fremder Piktogramme daneben haette zwei Haende.
 *
 * **Gezeigt wird die Wirkung, nicht der Name** (Designregel 8). „Erfindung"
 * heisst die Karte, aber was sie tut, sind zwei Rohstoffe aus der Bank - also
 * liegen dort zwei Karten und keine Gluehbirne. „Monopol" ist kein Ding, seine
 * Wirkung schon: alles wandert in einen Sack.
 *
 * **Warum es hier Motive gibt und beim Kaufstapel keine.** Der Ruecken redet
 * vom Stapel und darf nichts verraten (siehe `DeckPanel`). Diese Karten liegen
 * offen in der eigenen Hand - sie duerfen und sollen sagen, was sie sind.
 *
 * Der Name bleibt trotzdem unter jedem Motiv stehen, anders als bei den
 * Handkarten. Dort tragen Gelaendefarbe **und** Motiv dieselbe Aussage doppelt;
 * hier sind alle fuenf Karten dasselbe Pergament, das Motiv waere der einzige
 * Traeger - und genau das verbietet Designregel 7.
 *
 * **Die Klasse ist uebersteuerbar, seit der Helm zweimal gebraucht wird.** Er
 * steht auf der Ritterkarte und - eine Handbreit kleiner - in der Plakette am
 * Tisch, die sagt, wie viele Ritter jemand schon ausgespielt hat. Zwei Motive
 * fuer dieselbe Sache waeren zwei Helme, die irgendwann auseinanderlaufen; die
 * Groesse ist das einzige, was sich unterscheiden soll, und die steht im Blatt.
 */
export function DevelopmentGlyph({
  card,
  className = 'devcard__glyph',
}: {
  readonly card: DevelopmentCardId;
  readonly className?: string;
}): JSX.Element {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      {SHAPES[card]}
    </svg>
  );
}

const SHAPES: Readonly<Record<DevelopmentCardId, JSX.Element>> = {
  /**
   * Ritter: ein geschlossener Helm.
   *
   * Die Schlitze sind Loecher im selben Pfad (`fill-rule: evenodd`) und keine
   * hellen Striche darueber - so bleibt das Pergament der Karte sichtbar und
   * das Motiv einfarbig. Ein aufgemalter Sehschlitz saehe bei jeder anderen
   * Kartenfarbe falsch aus; ein Loch nie.
   */
  knight: (
    <path
      fillRule="evenodd"
      d="M12 2.4 C16.8 2.4 19.4 5.9 19.4 10.6 L19.4 17.4 C19.4 19.6 18 21.1 15.8 21.1 H8.2 C6 21.1 4.6 19.6 4.6 17.4 L4.6 10.6 C4.6 5.9 7.2 2.4 12 2.4 Z M6.4 9.4 H17.6 V11.8 H6.4 Z M10.7 13.6 H13.3 V19.6 H10.7 Z M7.2 14.8 H9.1 V16.4 H7.2 Z M14.9 14.8 H16.8 V16.4 H14.9 Z"
    />
  ),

  /**
   * Strassenbau: zwei Strassen.
   *
   * Derselbe Balken mit runden Enden, den eine gebaute Strasse auf dem Brett
   * ist (`board/shapes.ts`) - wer die Karte spielt, sucht danach gleich eine
   * Kante. Zwei davon, leicht auseinandergedreht, weil die Karte genau zwei
   * hergibt; sie beruehren sich nicht, sonst waeren sie ein Balken.
   */
  roadBuilding: (
    <g>
      <rect x="2.6" y="6.2" width="18.8" height="3.4" rx="1.7" transform="rotate(-11 12 7.9)" />
      <rect x="2.6" y="14.4" width="18.8" height="3.4" rx="1.7" transform="rotate(11 12 16.1)" />
    </g>
  ),

  /**
   * Erfindung: zwei Karten aus der Bank.
   *
   * Eine Karte ist in diesem Spiel die Form, in der ein Rohstoff vorkommt -
   * also zwei Karten fuer zwei Rohstoffe, in der Sprache, die der Tisch schon
   * spricht. Sie stehen mit Abstand nebeneinander und ueberlappen nicht: zwei
   * gleich gefuellte Formen, die sich schneiden, sind eine Form.
   */
  yearOfPlenty: (
    <g>
      <rect x="2.8" y="7.2" width="8.4" height="12.6" rx="1.4" transform="rotate(-6 7 13.5)" />
      <rect x="12.8" y="4.6" width="8.4" height="12.6" rx="1.4" transform="rotate(6 17 10.9)" />
    </g>
  ),

  /**
   * Monopol: ein Sack mit zugebundenem Hals.
   *
   * Kein Pfeilbild und kein Diagramm - die Nachbarn im Blatt sind Ziegel, Baum
   * und Schaf, also Dinge. Ein Sack ist die dingliche Fassung von „alle geben
   * dir ab": was die anderen haben, liegt danach hier drin.
   */
  monopoly: (
    <g>
      <path d="M8.6 8.8 H15.4 C18.2 11 20 14.4 20 17 C20 19.6 17.4 21.2 12 21.2 C6.6 21.2 4 19.6 4 17 C4 14.4 5.8 11 8.6 8.8 Z" />
      <path d="M8 4.6 C8 3.7 8.7 3 9.6 3 H14.4 C15.3 3 16 3.7 16 4.6 V6.6 C16 7.5 15.3 8.2 14.4 8.2 H9.6 C8.7 8.2 8 7.5 8 6.6 Z" />
    </g>
  ),

  /**
   * Siegpunkt: eine Krone.
   *
   * Sie ist die einzige Karte, die nie gespielt wird - sie zaehlt nur. Deshalb
   * ein Zeichen fuer den Ausgang und keines fuer eine Handlung: kein Werkzeug,
   * kein Weg, kein Sack, sondern das, was am Ende dasteht.
   */
  victoryPoint: (
    <g>
      <path d="M3.4 8.2 L7.5 11.8 L12 4.6 L16.5 11.8 L20.6 8.2 L19.1 17.6 H4.9 Z" />
      <rect x="4.6" y="18.6" width="14.8" height="2.6" rx="1" />
    </g>
  ),
};
