import type { CSSProperties, JSX } from 'react';
import type { PlayerId } from '@conquerist/shared';
import { awardFoot, awardTitle, type Award } from '../game/awards';
import { AwardGlyph } from './AwardGlyph';
import { DevelopmentGlyph } from './DevelopmentGlyph';

/**
 * Die zwei Auszeichnungen - und wo sie liegen.
 *
 * **Rolle:** die Karte wandert, statt dass drei Anzeigen sie beschreiben. Am
 * Tisch liegt die Laengste Handelsstrasse in der Mitte, bis sie jemand nimmt;
 * dann liegt sie vor ihm, sichtbar fuer alle, bis sie ihm einer wegnimmt. Genau
 * dieser Weg ist hier nachgebaut und ist der Grund, warum es **drei**
 * Darstellungen gibt und nicht eine:
 *
 * - `OpenAwards` — was noch niemand hat, liegt in der rechten Ecke beim uebrigen
 *   Bankmaterial. Es steht dort mit seiner Bedingung („ab 5 Straßen"), denn
 *   solange sie frei ist, ist die Bedingung die einzige Auskunft, die zaehlt.
 * - `AwardCards` — was man selbst haelt, liegt unten links bei den eigenen
 *   Karten. Als Karte und nicht als Zeile: sie ist Besitz, sie bringt Punkte,
 *   und sie ist die einzige Karte des Spiels, die einem wieder abgenommen
 *   werden kann.
 * - `SeatMarks` — was ein anderer haelt, steht als Plakette neben seinem Namen
 *   am Tisch. Klein, weil man sie nicht anfasst; oben links, weil der Tisch die
 *   Frage beantwortet, die man ueber andere stellt (siehe `TablePanel`).
 *
 * Ein Stueck ist damit immer an genau **einem** Ort, und der Ort sagt schon,
 * wem es gehoert. Zwei Anzeigen desselben Besitzes waeren zwei Stellen, an
 * denen dieselbe Frage anders beantwortet werden koennte.
 *
 * **Woran man sich erinnert:** dass die Karte umzieht. Sie verschwindet aus der
 * Ecke, in der sie eine Partie lang lag, und taucht bei jemandem auf.
 *
 * **Quadratisch, und das ist keine Laune.** Die Auszeichnungen sind am Tisch
 * die einzigen Karten im Querformat - die Rohstoff- und Entwicklungskarten
 * stehen hoch. Wer die Ecke ueberfliegt, unterscheidet sie an der Form, bevor
 * er ein Motiv gelesen hat, und das ist genau die Sorte Unterschied, die eine
 * Ablage lesbar macht.
 */
export interface AwardCardsProps {
  readonly awards: readonly Award[];
}

/**
 * Was man selbst haelt - unten links, bei den eigenen Karten.
 *
 * Kein Knopf: es gibt nichts zu druecken. Dieselbe Setzung wie beim Siegpunkt
 * unter den Entwicklungskarten, und aus demselben Grund - ein Bedienelement,
 * das in keiner Lage jemals angeht, sagt „gerade nicht" ueber etwas, das nie
 * geht.
 *
 * Die Kante traegt die eigene Sitzfarbe. Sie ist hier nicht noetig, um zu
 * sagen, wem die Karte gehoert (das sagt der Ort), sondern damit die Karte
 * beim Wechsel wiedererkennbar ist: dieselbe Farbe steht drueben am Tisch in
 * der Plakette und am Rand der Sitzzeile.
 */
export function AwardCards({ awards }: AwardCardsProps): JSX.Element | null {
  if (awards.length === 0) return null;

  return (
    <ol className="awards" aria-label="Deine Auszeichnungen">
      {awards.map((award) => (
        <li key={award.id}>
          <div
            className="awardcard awardcard--held"
            data-testid={`award-mine-${award.id}`}
            title={awardTitle(award)}
            {...(award.holderColor === null
              ? {}
              : { style: { '--seat': award.holderColor } as CSSProperties })}
          >
            <Body award={award} />
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * Was noch frei liegt - in der rechten Ecke, beim Bankmaterial.
 *
 * **Sie liegt da und ist nicht ausgegraut.** Ein blasser Umriss haette „gibt es
 * hier nicht" gesagt; die Karte gibt es aber, sie ist nur noch zu haben. Was
 * ihren Zustand traegt, ist die Fusszeile: statt eines Wertes steht dort, was
 * es kostet, sie zu bekommen.
 *
 * Verschwindet, sobald beide vergeben sind - eine leere Ecke, die „hier lag
 * mal etwas" sagt, ist Platz ohne Auskunft.
 */
export function OpenAwards({ awards }: AwardCardsProps): JSX.Element | null {
  if (awards.length === 0) return null;

  return (
    <section className="awards awards--open" aria-label="Noch zu vergeben">
      {awards.map((award) => (
        <div
          key={award.id}
          className="awardcard awardcard--open"
          data-testid={`award-open-${award.id}`}
          title={awardTitle(award)}
        >
          <Body award={award} />
        </div>
      ))}
    </section>
  );
}

/**
 * Der Kartenkoerper: Motiv, Name, Fusszeile.
 *
 * Der Name steht **auf** der Karte und nicht darunter - dieselbe Entscheidung
 * wie bei den Entwicklungskarten, und aus demselben Grund: beide Karten sind
 * dasselbe Pergament, das Motiv waere der einzige Traeger, und Form oder Farbe
 * allein duerfen das nie sein (Designregel 7).
 */
function Body({ award }: { readonly award: Award }): JSX.Element {
  return (
    <>
      <AwardGlyph award={award.id} />
      <span className="awardcard__name">{award.short}</span>
      <span className="awardcard__foot" aria-hidden="true">
        {awardFoot(award)}
      </span>
      <span className="visually-hidden">{awardTitle(award)}</span>
    </>
  );
}

/**
 * Die Plaketten neben einem Namen am Tisch: fremde Auszeichnungen und
 * ausgespielte Ritter.
 *
 * **Die Ritterzahl steht bei allen, die Auszeichnung nur bei den anderen.** Das
 * ist kein Versehen, sondern der Unterschied zwischen einem Zaehler und einem
 * Besitz: die eigene Auszeichnung liegt als Karte unten links, ein zweites Mal
 * am Tisch waere dieselbe Auskunft an zwei Orten. Wie viele Ritter man selbst
 * schon ausgespielt hat, steht dagegen **nirgends sonst** - die Karten sind
 * beim Ausspielen aus der Hand verschwunden, und ohne diese Zahl muesste man
 * sie sich merken. Genau daran haengt, ob sich der naechste Ritter lohnt.
 *
 * Die Plakette ist ein Stueck Pergament auf der Tiefsee-Flaeche, also dasselbe
 * Material wie die Karte, die sie vertritt - nur handgross statt kartengross.
 */
export function SeatMarks({
  player,
  awards,
  knights,
}: {
  /** Wessen Zeile das ist - die Plaketten tragen ihn in ihrer Testkennung. */
  readonly player: PlayerId;
  /** Auszeichnungen dieses Spielers - beim Empfaenger selbst leer, siehe oben. */
  readonly awards: readonly Award[];
  readonly knights: number;
}): JSX.Element | null {
  if (awards.length === 0 && knights === 0) return null;

  return (
    <span className="seat__marks">
      {awards.map((award) => (
        <span
          key={award.id}
          className="seat__mark"
          data-testid={`seat-award-${award.id}-${player}`}
          title={awardTitle(award)}
        >
          <AwardGlyph award={award.id} className="seat__mark-glyph" />
          <span className="visually-hidden">{awardTitle(award)}</span>
        </span>
      ))}

      {knights > 0 ? (
        <span
          className="seat__mark seat__mark--count"
          data-testid={`seat-knights-${player}`}
          title={`${knights} ausgespielte Ritter`}
        >
          <DevelopmentGlyph card="knight" className="seat__mark-glyph" />
          <span className="seat__mark-number" aria-hidden="true">
            {knights}
          </span>
          <span className="visually-hidden">{`${knights} ausgespielte Ritter`}</span>
        </span>
      ) : null}
    </span>
  );
}
