import type { CSSProperties, JSX } from 'react';
import { CARD_IDS, isCommodity, type CardAmounts, type CardId } from '@conquerist/shared';
import { CARD_COLORS, CARD_LABELS } from '../game/labels';
import { CardGlyph } from './CardGlyph';

/**
 * Eine Kartensorte als Karte - Gelaendefarbe, Motiv, Name.
 *
 * **Es gab ihn fuenfmal.** Auf der Hand als Stapel, im Kauffenster von
 * „Erfindung" als Farbplatte, im Bankhandel als Karte - und im Abwurffenster,
 * im Angebot und in den Angebotsbedingungen als nackter Text. Fuenf Formen fuer
 * dieselbe Sache, und die drei letzten waren die Stellen, an denen es am
 * meisten darauf ankommt: dort waehlt man unter Zeitdruck aus, was man hergibt.
 *
 * Jetzt gibt es **eine** Karte, und die anderen bauen um sie herum: der
 * Bankhandel legt ein `label` mit einem Radiofeld darum, das Abwurffenster
 * einen Schrittzaehler darunter, die Angebotsbedingungen gar nichts. Wer die
 * Karte aendert, aendert sie ueberall - und das ist der Punkt.
 *
 * **Die Handkarte bleibt draussen.** Sie ist 4.6rem breit, traegt Stapeltiefe
 * und liegt auf dem Tisch statt in einem Fenster; sie ist ein anderes Ding und
 * nicht eine groessere Ausgabe von diesem.
 *
 * Farbe und Motiv tragen dieselbe Aussage doppelt (Designregel 7): wer Farben
 * schlecht unterscheidet, liest das Motiv, wer schnell schaut, die Farbe - und
 * der Name steht ohnehin dabei.
 *
 * **Die Handelsware ist dieselbe Karte in anderer Ausfuehrung**, nicht eine
 * zweite Komponente. Ein Rohstoff ist ganzflaechig gelaendefarben; eine
 * Handelsware hat einen Pergamentkoerper mit gelaendefarbenem **Rand**. Papier
 * kommt aus dem Wald, aber Holz und Papier duerfen nicht gleich aussehen - man
 * haelt beide gleichzeitig auf der Hand und waehlt unter Zeitdruck aus.
 * Gleiche Farbe, andere Flaeche heisst "vom selben Land, andere Art von Ware".
 *
 * Zwei Komponenten waeren zwei Gelegenheiten auseinanderzulaufen - genau die
 * Begruendung, die oben schon fuer die eine Karte steht.
 */
export interface ResourceCardProps {
  readonly card: CardId;
  /**
   * Was unter dem Namen steht.
   *
   * Drei Faelle, und der mittlere ist der Grund fuer die Unterscheidung:
   * `undefined` laesst die Zeile weg (Angebotsbedingungen), eine Zahl schreibt
   * „von 3" (was man hergeben kann), und **`null` haelt sie leer**. Das
   * braucht der Bankhandel: dort steht der Bestand nur auf der Gebeseite, und
   * ohne die leere Zeile waeren die zwei Reihen verschieden hoch. Derselbe
   * Kniff wie bei der Aufforderung unter den Wuerfeln.
   */
  readonly held?: number | null;
  /** Die Plakette in der Ecke - fuer Mengen, die nicht gewaehlt, sondern genannt werden. */
  readonly count?: number;
}

export function ResourceCard({ card, held, count }: ResourceCardProps): JSX.Element {
  const ware = isCommodity(card);

  return (
    <span
      className={ware ? 'rescard rescard--ware' : 'rescard'}
      /*
       * Bei der Handelsware faerbt die Gelaendefarbe den Rand, bei einem
       * Rohstoff die Flaeche. Beides per `style`, weil eine Variable im Blatt
       * die Farbe nicht kennen kann - und eine CSS-Regel schlaegt ein
       * gleichnamiges Attribut (die Falle aus `CLAUDE.md`).
       */
      style={
        ware
          ? ({ '--ware-edge': CARD_COLORS[card] } as CSSProperties)
          : { background: CARD_COLORS[card] }
      }
      title={CARD_LABELS[card]}
    >
      <CardGlyph card={card} />
      <span className="rescard__name">{CARD_LABELS[card]}</span>

      {held === undefined ? null : (
        /*
         * Die Null bleibt stehen und wird blass - dieselbe Entscheidung wie
         * beim Bauvorrat: ein fehlender Eintrag saehe aus wie ein
         * Anzeigefehler, „von 0" ist dagegen genau die Auskunft, um die es geht.
         */
        <span
          className={held === 0 ? 'rescard__held rescard__held--empty' : 'rescard__held'}
          aria-hidden="true"
        >
          {held === null ? '' : `von ${held}`}
        </span>
      )}

      {count === undefined ? null : (
        <span className="card__count" aria-hidden="true">
          {count}
        </span>
      )}
    </span>
  );
}

/**
 * Ein Posten aus mehreren Sorten - was in einem Angebot ueber den Tisch geht.
 *
 * Er stand als Satz da („2 Holz, 1 Erz"), und das ist genau die Stelle, an der
 * ein Angebot entschieden wird: man liest, was man hergibt, und antwortet
 * innerhalb einer Frist. Als Kartenreihe ist es ein Blick statt eines Satzes.
 *
 * Der Name bleibt trotzdem auf jeder Karte - vorgelesen wird die Reihe damit
 * weiter als „2 Holz, 1 Erz", und wer die Farben nicht unterscheidet, verliert
 * nichts.
 */
export function ResourceRow({ amounts }: { readonly amounts: CardAmounts }): JSX.Element {
  /*
   * Ueber alle Kartensorten und nicht nur ueber die Rohstoffe: ein Angebot
   * darf Handelswaren enthalten. In einer Basispartie steht trotzdem nie eine
   * dabei, weil ihre Menge dort null ist - und was null ist, faellt hier
   * ohnehin heraus.
   */
  const posten = CARD_IDS.map((card) => ({
    card,
    amount: amounts[card] ?? 0,
  })).filter((entry) => entry.amount > 0);

  // Kommt vor: ein Gegenangebot, das nur nimmt oder nur gibt, weist der
  // Reducer zwar ab - aber der Dialog zeigt auch halbfertige Staende.
  if (posten.length === 0) return <span className="rescards__empty">nichts</span>;

  return (
    <span className="rescards">
      {posten.map(({ card, amount }) => (
        <ResourceCard key={card} card={card} count={amount} />
      ))}
    </span>
  );
}
