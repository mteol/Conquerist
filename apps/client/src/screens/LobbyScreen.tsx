import { useState, type JSX } from 'react';
import { seatColorAt, type RoomEvent } from '@conquerist/shared';
import { invitationLink } from '../net/session';

/**
 * Der Wartebereich.
 *
 * **Rolle:** Die einzige Flaeche im Spiel, auf der es nichts zu tun gibt ausser
 * warten. Ihre Aufgabe ist deshalb genau zwei Dinge: den Code weitergeben und
 * zeigen, wer schon da ist.
 *
 * **Aufbau:** Der Raumcode ist das groesste Element der ganzen Anwendung - vier
 * Zeichen auf Pergament, weit gesperrt, damit er sich vorlesen laesst. Darunter
 * der Einladungslink zum Kopieren, dann der Tisch, unten die eine Handlung.
 *
 * **Das eine Element, an das man sich erinnert:** der Tisch mit den leeren
 * Plaetzen. Jeder noch freie Platz steht als blasser, gestrichelter Spielstein
 * da - in genau der Farbe, die dieser Platz bekommen wird. Wie viele fehlen,
 * sieht man, ohne eine Zahl zu lesen, und wer beitritt, fuellt sichtbar seinen
 * Umriss. Die Sitzfarben aus `shared` tragen damit eine Information statt einer
 * Verzierung. Die Zahl steht trotzdem daneben: Farbe und Form allein duerfen
 * nichts tragen, was jemand sonst nicht mitbekommt.
 */
export interface LobbyScreenProps {
  readonly room: RoomEvent;
  readonly youId: string;
  readonly onStart: () => void;
  readonly onLeave: () => void;
}

export function LobbyScreen({ room, youId, onStart, onLeave }: LobbyScreenProps): JSX.Element {
  const [copied, setCopied] = useState(false);

  const host = room.seats.find((seat) => seat.userId === room.hostId);
  const youAreHost = room.hostId === youId;
  const missing = room.seatCount - room.seats.length;
  const open = Array.from({ length: Math.max(missing, 0) }, (_unused, index) => index);

  const copyLink = (): void => {
    void navigator.clipboard.writeText(invitationLink(room.code)).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      },
      () => {
        // Ohne Zwischenablage bleibt der Link lesbar daneben stehen. Eine
        // Fehlermeldung waere hier lauter als das Problem.
        setCopied(false);
      },
    );
  };

  return (
    <main className="lobby">
      <header className="lobby__head">
        <span className="eyebrow">Raumcode</span>
        <p className="lobby__code">{room.code}</p>
        <p className="lobby__lead">
          Vorlesen oder den Link schicken — beides führt an denselben Tisch.
        </p>
      </header>

      <div className="lobby__invite">
        <input readOnly aria-label="Einladungslink" value={invitationLink(room.code)} />
        <button type="button" className="button button--ghost" onClick={copyLink}>
          {copied ? 'Kopiert' : 'Link kopieren'}
        </button>
      </div>

      <section className="lobby__table" aria-label="Am Tisch">
        <ol className="lobby__seats">
          {room.seats.map((seat) => (
            <li key={seat.userId} className="lobby__seat" data-testid="seat-taken">
              <SeatPiece color={seat.color} />
              <span className="lobby__name">{seat.name}</span>
              <span className="lobby__status">
                {seat.userId === youId ? 'du' : seat.connected ? 'verbunden' : 'getrennt'}
              </span>
            </li>
          ))}

          {open.map((offset) => (
            <li
              key={`offen-${offset}`}
              className="lobby__seat lobby__seat--open"
              data-testid="seat-open"
            >
              <SeatPiece color={seatColorAt(room.seats.length + offset)} open />
              <span className="lobby__name">Frei</span>
              <span className="lobby__status">wartet</span>
            </li>
          ))}
        </ol>
      </section>

      <footer className="lobby__foot">
        {youAreHost ? (
          <>
            <button
              type="button"
              className="button button--go"
              disabled={missing > 0}
              onClick={onStart}
            >
              Partie starten
            </button>
            <p className="lobby__hint">
              {missing === 0
                ? 'Alle sind da.'
                : missing === 1
                  ? 'Es fehlt noch 1 Mitspieler.'
                  : `Es fehlen noch ${missing} Mitspieler.`}
            </p>
          </>
        ) : (
          <p className="lobby__hint">
            Wartet auf {host?.name ?? 'die Person, die den Raum erstellt hat'}.
          </p>
        )}

        <button type="button" className="button button--ghost" onClick={onLeave}>
          Tisch verlassen
        </button>
      </footer>
    </main>
  );
}

/**
 * Der Spielstein aus dem Brett, klein.
 *
 * Dieselbe Silhouette wie die Siedlung auf dem Feld: wer hier seine Farbe
 * sieht, erkennt sie dort wieder. `open` zeichnet nur den Umriss - der Platz,
 * den es noch zu besetzen gibt.
 *
 * Farbe per `style` und nicht als Attribut: eine CSS-Regel schlaegt das
 * gleichnamige SVG-Praesentationsattribut, und genau daran ist in Etappe 3
 * jede gebaute Strasse unsichtbar geworden.
 */
function SeatPiece({
  color,
  open = false,
}: {
  readonly color: string;
  readonly open?: boolean;
}): JSX.Element {
  return (
    <svg className="piece piece--seat" viewBox="-10 -12 20 22" aria-hidden="true">
      <path
        d="M -8 8 L -8 -2 L 0 -10 L 8 -2 L 8 8 Z"
        style={{
          fill: open ? 'transparent' : color,
          stroke: color,
          strokeDasharray: open ? '3 3' : undefined,
          opacity: open ? 0.5 : 1,
        }}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </svg>
  );
}
