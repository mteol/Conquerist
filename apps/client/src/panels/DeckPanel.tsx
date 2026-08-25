import type { CSSProperties, JSX } from 'react';
import type { CardAmounts } from '@conquerist/shared';
import { resourceList } from '../game/labels';
import { CostHint } from './CostHint';

/**
 * Der Entwicklungsstapel - als Stapel, nicht als Knopf mit Beschriftung.
 *
 * **Rolle:** die Bank, soweit sie auf dem Tisch liegt. Man kauft dort eine
 * Karte, und das war bis hierher ein Knopf mit der Aufschrift „Karte kaufen"
 * zwischen zwei anderen Knoepfen - dieselbe Form wie „Handel" und „Zug
 * beenden", obwohl es das einzige Spielmaterial unter ihnen ist.
 *
 * **Aufbau:** versetzte Kartenruecken, daneben der Preis, darunter die Zahl,
 * die noch im Stapel liegt, und darunter, was ein Klick tut.
 *
 * **Die Karte ist kleiner geworden, und das nimmt eine fruehere Entscheidung
 * zurueck.** Hier stand: dieselbe Groesse wie die Karten in der Hand daneben,
 * weil es dieselbe Sorte Ding ist - „3.1rem neben 4.6rem hat aus der Bank ein
 * Beiwerk gemacht". Der Satz stimmt, nur galt er fuer einen Stapel, der allein
 * dastand. Seit der Preis daneben liegt, sind es zwei Dinge in einer Ecke, die
 * `--tray-strip` breit ist und sonst nichts hergibt: die Karte gibt genau so
 * viel ab, wie die Preisspalte braucht, und das Paar nimmt zusammen den Platz
 * ein, den die Karte vorher allein hatte. Ein Beiwerk wird sie davon nicht -
 * sie ist immer noch das groesste Stueck in dieser Ecke.
 *
 * **Woran man sich erinnert:** dass der Stapel duenner wird. Die Zahl steht
 * darunter, weil man sie vergleicht - auf derselben Hoehe wie die Zahlen unter
 * den Bauteilen; die Tiefe ist der schnelle Eindruck. Ist er leer, bleibt er
 * stehen und sagt das - ein verschwundener Stapel saehe aus wie ein
 * Anzeigefehler.
 */
export interface DeckPanelProps {
  /** Wie viele Karten der Stapel noch hergibt. */
  readonly left: number;
  /**
   * Ob der Kauf jetzt geht - kommt aus der Aktionsliste, nicht aus einer
   * eigenen Rechnung ueber Karten und Kosten.
   */
  readonly canBuy: boolean;
  /** Was eine Karte kostet - aus dem Regelwerk der Partie (siehe `ActionPanel`). */
  readonly cost: CardAmounts;
  readonly onBuy: () => void;
}

export function DeckPanel({ left, canBuy, cost, onBuy }: DeckPanelProps): JSX.Element {
  /*
   * Der oberste Ruecken ist gezeichnet, die darunter sind nur Tiefe - deshalb
   * einer weniger als die Zahl sagt. Ab drei waechst der Stapel nicht weiter,
   * sonst waere er am Anfang der Partie so hoch wie die Leiste daneben.
   */
  const behind = Math.max(Math.min(left, 3) - 1, 0);

  return (
    <section className="deck" aria-label="Entwicklungskarten kaufen">
      <button
        type="button"
        className={canBuy ? 'deck__pile deck__pile--ready' : 'deck__pile'}
        data-testid="deck-buy"
        disabled={!canBuy}
        title={left === 0 ? 'Der Stapel ist leer' : `Noch ${left} Karten im Stapel`}
        onClick={onBuy}
      >
        {/*
         * Preis und Stapel nebeneinander, und zwar in dieser Reihenfolge: was
         * man hergibt, steht links von dem, was man bekommt. Ueber der Karte
         * ginge es nicht - dort liegt der Faecher, der sich beim Darueberfahren
         * aufspreizt, und zwei Dinge an derselben Stelle koennen nicht beide
         * zeigen, was sie meinen.
         */}
        <span className="deck__stage">
          <CostHint cost={cost} layout="column" className="deck__cost" />

          <span className="deck__body">
            <span className="deck__behind-stack" aria-hidden="true">
              {/*
               * Nur die Lage im Stapel wird uebergeben, nicht die fertige
               * Verschiebung: ein `transform` im `style` liesse sich vom Blatt
               * nicht mehr ueberschreiben, und genau das braucht die Faecherung
               * beim Darueberfahren. Was aus `--i` wird, steht in `index.css`.
               */}
              {Array.from({ length: behind }, (_unused, index) => (
                <span
                  key={index}
                  className="deck__behind"
                  style={{ '--i': index + 1 } as CSSProperties}
                />
              ))}
            </span>

            <CardBack />
          </span>
        </span>

        <span className="deck__count" data-testid="deck-left" aria-hidden="true">
          {left}
        </span>

        <span className="deck__label">{left === 0 ? 'Stapel leer' : 'Karte kaufen'}</span>

        <span className="visually-hidden">
          {left === 0
            ? 'Der Stapel ist leer'
            : `noch ${left} Karten im Stapel, kostet ${resourceList(cost)}`}
        </span>
      </button>
    </section>
  );
}

/**
 * Der Kartenruecken: das Siegel der Bank.
 *
 * **Warum jetzt doch ein Motiv.** Hier stand bis eben, der Ruecken trage
 * keines: was auf einer Entwicklungskarte steht, weiss beim Kauf niemand, und
 * ein Ritter darauf waere ein Versprechen, das der Stapel nicht halten kann.
 * Der Satz stimmt - er verbietet aber nur Motive, die vom *Inhalt* reden. Ein
 * Ruecken redet vom *Stapel*: er sagt „diese Karten gehoeren zusammen und keine
 * verraet sich", und das ist die aelteste Aufgabe eines Kartenruecken
 * ueberhaupt. Ohne ihn war die Bank ein leeres beiges Rechteck.
 *
 * **Woraus er besteht** - drei Lagen, alle aus dem Material, das das Spiel
 * schon hat:
 *
 * 1. **Das Feld:** ein Gitter kleiner Sechsecke, versetzt gesetzt. Das Sechseck
 *    ist die Grundform des Bretts; als Papierstruktur gelesen macht es aus dem
 *    Ruecken eine Karte *dieses* Spiels und nicht irgendeine Ruckseite mit
 *    Rautenmuster.
 * 2. **Die Fassung:** zwei eingerueckte Linien, aussen kraeftig, innen fein.
 *    Das ist die Grammatik jedes Kartenruecken, den es je gab, und sie tut hier
 *    dasselbe wie ueberall: sie macht aus einem Rechteck eine Karte.
 * 3. **Das Siegel:** eine Scheibe aus Tiefsee-Tinte mit goldenem Ring, darin
 *    ein Sechseck aus Pergamentlinie - **und das Sechseck ist leer.** Genau da
 *    steckt der alte Einwand: das Siegel sagt „verschlossen", nicht „Ritter".
 *    Der gestrichelte Ring darum ist die Perforation, an der man aufbricht.
 *
 * **Keine Farbe, die es nicht schon gibt.** Pergament, Tiefsee, der Akzent aus
 * `--fields` - alle drei stehen in `index.css`, keine einzige in dieser Datei
 * (Designregel 2). Die Zeichnung selbst steht hier, weil sie nur ein Ding
 * beschreibt und nirgends sonst gebraucht wird; die Rueckseiten der Handkarten
 * sind ein *anderer* Stapel und behalten ihr eigenes Muster.
 *
 * Die feste `id` fuer das Muster ist in Ordnung, weil der Kaufstapel je
 * Bildschirm genau einmal liegt. Zwei davon waeren zwei gleiche Ids - wer den
 * Ruecken ein zweites Mal einbaut, gibt ihm vorher eine mitgegebene Kennung.
 */
function CardBack(): JSX.Element {
  return (
    <svg className="deck__face" viewBox="0 0 46 58" aria-hidden="true">
      <defs>
        <linearGradient id="conquerist-deck-paper" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" className="deck__paper-light" />
          <stop offset="1" className="deck__paper-dark" />
        </linearGradient>

        {/*
         * Zwei versetzte Sechsecke je Kachel, beide vollstaendig innerhalb der
         * Kachel: so setzt sich das Gitter ohne Naht fort, ohne dass irgendwo
         * eine halbe Form an der Kante klebt.
         */}
        <pattern id="conquerist-deck-lattice" width="12" height="12" patternUnits="userSpaceOnUse">
          <path
            className="deck__lattice"
            d="M 3 0.4 L 5.252 1.7 L 5.252 4.3 L 3 5.6 L 0.748 4.3 L 0.748 1.7 Z"
          />
          <path
            className="deck__lattice"
            d="M 9 6.4 L 11.252 7.7 L 11.252 10.3 L 9 11.6 L 6.748 10.3 L 6.748 7.7 Z"
          />
        </pattern>
      </defs>

      <rect
        x="0.6"
        y="0.6"
        width="44.8"
        height="56.8"
        rx="4"
        fill="url(#conquerist-deck-paper)"
        className="deck__paper"
      />
      <rect
        x="0.6"
        y="0.6"
        width="44.8"
        height="56.8"
        rx="4"
        fill="url(#conquerist-deck-lattice)"
      />

      <rect className="deck__rule" x="3.4" y="3.4" width="39.2" height="51.2" rx="2.6" />
      <rect
        className="deck__rule deck__rule--fine"
        x="6.4"
        y="6.4"
        width="33.2"
        height="45.2"
        rx="1.8"
      />

      <circle className="deck__perforation" cx="23" cy="29" r="14" />
      <circle className="deck__seal" cx="23" cy="29" r="11.5" />
      <circle className="deck__seal-ring" cx="23" cy="29" r="11.5" />
      <path
        className="deck__seal-hex"
        d="M 23 22.1 L 28.975 25.55 L 28.975 32.45 L 23 35.9 L 17.025 32.45 L 17.025 25.55 Z"
      />
    </svg>
  );
}
