import type { JSX } from 'react';
import type { EventFace } from '@conquerist/shared';
import { COMMODITY_SHAPES } from './CardGlyph';

/**
 * Die Seite des Ereigniswuerfels.
 *
 * **Rolle:** sagt, was in dieser Runde ausser dem Ertrag geschieht - das Schiff
 * kommt naeher, oder ein Bereich schuettet Fortschrittskarten aus.
 * **Aufbau:** derselbe Wuerfelkoerper wie bei den Augenwuerfeln, aber ein
 * Zeichen statt Punkten. **Woran man sich erinnert:** dass drei von sechs
 * Seiten das Schiff zeigen.
 *
 * **Die Farbe traegt nicht allein.** Die drei Stadttore heissen in der
 * Schachtel gelb, blau und gruen und unterscheiden sich sonst nicht - hier
 * steht in jedem Tor zusaetzlich das Motiv der Handelsware, mit der sein
 * Bereich bezahlt wird: Tuch fuer Handel, Muenzen fuer Politik, Papier fuer
 * Wissenschaft. Das ist kein Zierat, sondern genau die Auskunft, die man
 * braucht - wer ein gelbes Tor sieht, soll wissen, dass er Tuch verbaut hat.
 *
 * Und es ist die Regel aus `CLAUDE.md`: Farbe ist nie der einzige Traeger.
 */
export function EventDie({ face }: { readonly face: EventFace }): JSX.Element {
  return (
    <svg className="die__event" viewBox="0 0 24 24" aria-hidden="true">
      {face === 'ship' ? SHIP : <Gate face={face} />}
    </svg>
  );
}

/** Das deutsche Wort zu einer Wuerfelseite - fuer Vorleseansagen. */
export const EVENT_FACE_LABELS: Readonly<Record<EventFace, string>> = {
  ship: 'Barbarenschiff',
  trade: 'Handel',
  politics: 'Politik',
  science: 'Wissenschaft',
};

/**
 * Das Barbarenschiff: Rumpf, Mast, Segel.
 *
 * Eine Silhouette und kein Bild. Der Rumpf ist ein flacher Bogen mit
 * hochgezogenem Bug - das ist die Form, an der man ein Schiff auch bei
 * vierzehn Pixeln noch erkennt.
 */
const SHIP: JSX.Element = (
  <g className="die__event-ship">
    <path d="M12 3 L12 15 M12 6 L19 9 L12 11.5 Z" className="die__event-mast" />
    <path d="M2.5 15.5 H21.5 L18.5 21 H5.5 Z" />
  </g>
);

/**
 * Ein Stadttor: der Torbogen als Rahmen, das Motiv seines Bereichs darin.
 *
 * **Der Rahmen ist der Rahmen und nicht der Held.** Der erste Entwurf hatte
 * ein ausgemaltes Tor mit Tuermen und Zinnen und das Motiv in der Toroeffnung -
 * gerechnet waeren davon rund elf Pixel uebriggeblieben, und damit liegt es
 * unter der Grenze, an der schon die Auszeichnungsmotive entworfen wurden. Ein
 * Zeichen, das man nur kennt, wenn man es schon kennt, traegt nichts.
 *
 * Jetzt ist der Bogen eine Linie und das Motiv fuellt ihn aus: rund neunzehn
 * Pixel auf der ruhenden Seite. Die Form sagt "Stadttor", das Motiv sagt
 * welcher Bereich, die Farbe sagt es noch einmal.
 */
function Gate({ face }: { readonly face: Exclude<EventFace, 'ship'> }): JSX.Element {
  return (
    <g className={`die__event-gate die__event-gate--${face}`}>
      <path d="M3 22 V11 a9 9 0 0 1 18 0 V22" className="die__event-arch" />
      <g className="die__event-motif" transform="translate(6 6.5) scale(0.5)">
        {COMMODITY_SHAPES[COMMODITY_OF[face]]}
      </g>
    </g>
  );
}

/**
 * Womit ein Bereich bezahlt wird.
 *
 * Dieselbe Zuordnung wie `TRACK_COMMODITY` in `shared` - hier steht sie
 * ausdruecklich noch einmal, weil die Bereiche als Regel erst in Etappe 10c
 * kommen. Wenn sie da sind, faellt diese Tabelle weg und der Wuerfel liest die
 * eine aus `shared`.
 */
const COMMODITY_OF: Readonly<Record<Exclude<EventFace, 'ship'>, 'paper' | 'cloth' | 'coin'>> = {
  trade: 'cloth',
  politics: 'coin',
  science: 'paper',
};
