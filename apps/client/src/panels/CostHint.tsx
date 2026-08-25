import type { CSSProperties, JSX } from 'react';
import { RESOURCE_IDS, type CardAmounts, type ResourceId } from '@conquerist/shared';
import { RESOURCE_COLORS } from '../game/labels';
import { ResourceGlyph } from './ResourceGlyph';

/**
 * Was etwas kostet - als die Karten, die man dafuer hergibt.
 *
 * **Eine Marke je Karte und keine Zahl daneben.** „2× Korn" ist eine Rechnung,
 * zwei Kornmarken sind ein Blick: am Tisch aus Pappe legt man die Karten hin
 * und zaehlt sie nicht vor. Die Mengen des Basisspiels gehen bis drei, die
 * teuerste Sache kostet fuenf Karten - das bleibt ueberschaubar, und wo es eng
 * wird, bricht die Reihe um statt zu schrumpfen.
 *
 * **Dieselben zwei Traeger wie ueberall** (Designregel 7): die Gelaendefarbe
 * der Ressource und ihr Motiv aus `ResourceGlyph`. Wer Farben schlecht
 * unterscheidet, liest die Form; wer schnell schaut, die Farbe. Ein Name steht
 * nicht dabei - dafuer ist die Marke zu klein, und der Satz dazu steht im
 * zugaenglichen Namen des Knopfes, an dem dieses Zeichen haengt.
 *
 * **Rein zum Ansehen.** Das Zeichen ist `aria-hidden` und fuer die Maus
 * unsichtbar (`pointer-events` in `index.css`): es erscheint beim
 * Darueberfahren, und was es sagt, sagt der Knopf darunter noch einmal in
 * Worten. Sonst laege ueber jedem Bauteil eine zweite, stumme Bedienung.
 *
 * `--i` ist die Lage in der Reihe und wird im Blatt zur Verzoegerung - dieselbe
 * Staffelung wie am Eingang und im Kaufstapel. Die Marken kommen damit
 * nacheinander an, so wie jemand Karten hinlegt, statt gemeinsam
 * aufzuscheinen.
 */
export interface CostHintProps {
  readonly cost: CardAmounts;
  /**
   * Wo das Zeichen liegt - und damit, wie es sich stapelt.
   *
   * `row` steht ueber dem Bauteil und darf umbrechen; `column` steht neben dem
   * Kaufstapel, wo die Hoehe da ist und die Breite fehlt.
   */
  readonly layout?: 'row' | 'column';
  /** Die Klasse des Ortes - sie bringt Lage und Ein-/Ausblenden mit. */
  readonly className: string;
}

export function CostHint({ cost, layout = 'row', className }: CostHintProps): JSX.Element {
  return (
    <span
      className={`cost ${layout === 'column' ? 'cost--column' : 'cost--row'} ${className}`}
      aria-hidden="true"
    >
      {marksOf(cost).map((resource, index) => (
        <span
          key={`${resource}-${index}`}
          className="cost__mark"
          // Die Ressource steht als Attribut da, weil sie sonst nirgends als
          // Text vorkommt: die Marke traegt Farbe und Motiv, und beides laesst
          // sich nicht lesen. Ein Test prueft daran, dass eine Stadt wirklich
          // zwei Korn und drei Erz kostet und nicht bloss fuenf Marken zeigt.
          data-resource={resource}
          style={{ background: RESOURCE_COLORS[resource], '--i': index } as CSSProperties}
        >
          <ResourceGlyph resource={resource} />
        </span>
      ))}
    </span>
  );
}

/**
 * Die Kosten als Liste einzelner Karten, in der Reihenfolge von `RESOURCE_IDS`.
 *
 * Ueber `RESOURCE_IDS` und nicht ueber die Schluessel des Objekts: die
 * Reihenfolge soll ueberall dieselbe sein, damit Lehm und Holz bei Strasse und
 * Siedlung an derselben Stelle stehen. `Object.keys` gaebe die Reihenfolge des
 * Literals zurueck, und die ist eine Zufaelligkeit der Datei, in der es steht.
 */
function marksOf(cost: CardAmounts): readonly ResourceId[] {
  return RESOURCE_IDS.flatMap((resource) =>
    Array.from({ length: cost[resource] ?? 0 }, () => resource),
  );
}
