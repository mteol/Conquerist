import type { JSX } from 'react';
import { RESOURCE_IDS, type ResourceAmounts, type ResourceId } from '@conquerist/shared';
import { RESOURCE_COLORS, RESOURCE_LABELS } from '../game/labels';
import { ResourceGlyph } from './ResourceGlyph';

/**
 * Ein Rohstoff als Karte - Gelaendefarbe, Motiv, Name.
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
 */
export interface ResourceCardProps {
  readonly resource: ResourceId;
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

export function ResourceCard({ resource, held, count }: ResourceCardProps): JSX.Element {
  return (
    <span
      className="rescard"
      style={{ background: RESOURCE_COLORS[resource] }}
      title={RESOURCE_LABELS[resource]}
    >
      <ResourceGlyph resource={resource} />
      <span className="rescard__name">{RESOURCE_LABELS[resource]}</span>

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
export function ResourceRow({ amounts }: { readonly amounts: ResourceAmounts }): JSX.Element {
  const posten = RESOURCE_IDS.map((resource) => ({
    resource,
    amount: amounts[resource] ?? 0,
  })).filter((entry) => entry.amount > 0);

  // Kommt vor: ein Gegenangebot, das nur nimmt oder nur gibt, weist der
  // Reducer zwar ab - aber der Dialog zeigt auch halbfertige Staende.
  if (posten.length === 0) return <span className="rescards__empty">nichts</span>;

  return (
    <span className="rescards">
      {posten.map(({ resource, amount }) => (
        <ResourceCard key={resource} resource={resource} count={amount} />
      ))}
    </span>
  );
}
