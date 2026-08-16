import { useEffect, useState, type JSX } from 'react';
import {
  MAX_SEATS,
  MAX_VICTORY_POINT_GOAL,
  MIN_SEATS,
  MIN_VICTORY_POINT_GOAL,
  SEAT_COLORS,
  seatColorName,
  type RoomEvent,
} from '@conquerist/shared';
import { SETTLEMENT_PATH, VIEWBOX } from '../board/shapes';
import { invitationLink } from '../net/session';
import { randomSeed } from './StartScreen';

/**
 * Der Wartebereich.
 *
 * **Rolle:** Die einzige Flaeche im Spiel, auf der es nichts zu tun gibt ausser
 * warten. Ihre Aufgabe ist deshalb genau zwei Dinge: den Code weitergeben und
 * zeigen, wer schon da ist.
 *
 * **Aufbau:** Der Raumcode ist das groesste Element der ganzen Anwendung - vier
 * Zeichen auf Pergament, weit gesperrt, damit er sich vorlesen laesst. Darunter
 * der Einladungslink zum Kopieren, dann der Tisch samt Einstellungen, unten die
 * eine Handlung.
 *
 * **Die Partie bleibt formbar, solange niemand gestartet hat.** Tischgroesse,
 * Seed und Siegpunktziel lassen sich hier noch aendern - eine Runde soll nicht
 * deshalb neu gegruendet werden muessen, weil doch einer mehr mitspielt oder
 * zehn Punkte zu lange dauern. Die Tischgroesse wird dabei **am Tisch selbst**
 * eingestellt: der Host legt einen Platz dazu oder nimmt ihn weg, und derselbe
 * gestrichelte Umriss, der den freien Platz anzeigt, ist das Ergebnis.
 * Steuerelement und Anzeige sind dasselbe, und alle am Tisch sehen die
 * Aenderung sofort.
 *
 * **Was jedem selbst gehoert, stellt jeder selbst ein.** Tischgroesse, Brett
 * und Ziel gelten fuer alle und darf deshalb nur der Host anfassen; der eigene
 * Name und die eigene Farbe gehoeren niemandem sonst. Deshalb stehen sie in
 * einem eigenen Kasten, und der ist fuer jeden offen.
 *
 * **Das eine Element, an das man sich erinnert:** der Tisch mit den leeren
 * Plaetzen. Jeder noch freie Platz steht als blasser, gestrichelter Spielstein
 * da. Wie viele fehlen, sieht man, ohne eine Zahl zu lesen, und wer beitritt,
 * fuellt sichtbar seinen Umriss. Die Sitzfarben aus `shared` tragen damit eine
 * Information statt einer Verzierung. Die Zahl steht trotzdem daneben: Farbe
 * und Form allein duerfen nichts tragen, was jemand sonst nicht mitbekommt.
 */
export interface LobbyScreenProps {
  readonly room: RoomEvent;
  readonly youId: string;
  readonly onStart: () => void;
  readonly onLeave: () => void;
  /** Tischgroesse, Seed und Siegpunktziel umstellen. Der Server prueft alles noch einmal. */
  readonly onConfigure: (seatCount: number, seed: string, victoryPointGoal: number) => void;
  /** Sich eine Farbe aussuchen. Belegte weist der Server ab. */
  readonly onChooseColor: (color: string) => void;
  /** Sich umbenennen. */
  readonly onRename: (name: string) => void;
}

export function LobbyScreen({
  room,
  youId,
  onStart,
  onLeave,
  onConfigure,
  onChooseColor,
  onRename,
}: LobbyScreenProps): JSX.Element {
  const [copied, setCopied] = useState(false);

  const host = room.seats.find((seat) => seat.userId === room.hostId);
  const you = room.seats.find((seat) => seat.userId === youId);
  const youAreHost = room.hostId === youId;
  const missing = room.seatCount - room.seats.length;
  const open = Array.from({ length: Math.max(missing, 0) }, (_unused, index) => index);

  /*
   * Der Name im Feld gehoert dem Feld, solange jemand darin tippt - erst beim
   * Verlassen geht er hinaus. Ein `onChange`, das jeden Tastendruck schickt,
   * waere eine Nachricht je Buchstabe und ein Raumstand je Nachricht.
   *
   * Der Abgleich mit dem Server laeuft trotzdem: kommt ein anderer Name herein
   * (weil man sich am zweiten Geraet umbenannt hat), zieht das Feld nach.
   */
  const [name, setName] = useState(you?.name ?? '');
  useEffect(() => {
    if (you?.name !== undefined) setName(you.name);
  }, [you?.name]);

  const commitName = (): void => {
    const trimmed = name.trim();
    if (trimmed === '' || trimmed === you?.name) {
      setName(you?.name ?? '');
      return;
    }
    onRename(trimmed);
  };

  /*
   * Wer einstellen darf. Der Server prueft dasselbe noch einmal - hier geht es
   * nur darum, keinen Knopf anzubieten, der ohnehin abgelehnt wuerde.
   *
   * Kleiner als die Zahl der Sitzenden geht nicht: sonst muesste jemand seinen
   * Platz raeumen, und das ist im Wartebereich nicht zu entscheiden.
   */
  const canConfigure = youAreHost && !room.started;
  const canGrow = canConfigure && room.seatCount < MAX_SEATS;
  const canShrink = canConfigure && room.seatCount > Math.max(MIN_SEATS, room.seats.length);

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
              <SeatPiece color="currentColor" open />
              <span className="lobby__name">Frei</span>
              <span className="lobby__status">wartet</span>
            </li>
          ))}
        </ol>

        {canConfigure ? (
          <div className="lobby__resize">
            <button
              type="button"
              className="button button--ghost"
              disabled={!canShrink}
              onClick={() => onConfigure(room.seatCount - 1, room.seed, room.victoryPointGoal)}
            >
              Platz entfernen
            </button>
            <button
              type="button"
              className="button button--ghost"
              disabled={!canGrow}
              onClick={() => onConfigure(room.seatCount + 1, room.seed, room.victoryPointGoal)}
            >
              Platz hinzufügen
            </button>
          </div>
        ) : null}
      </section>

      {/*
       * Der eigene Kasten. Kein `canConfigure` davor: Name und Farbe gehoeren
       * dem, der sie traegt, und nicht dem, der den Raum aufgemacht hat.
       */}
      {you === undefined ? null : (
        <section className="lobby__setting lobby__you" aria-label="Du">
          <span className="eyebrow">Dein Platz</span>

          <label className="lobby__namefield">
            <span className="visually-hidden">Dein Name</span>
            <input
              aria-label="Dein Name"
              value={name}
              maxLength={16}
              onChange={(event) => setName(event.currentTarget.value)}
              onBlur={commitName}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
              }}
            />
          </label>

          {/*
           * Die Farbwahl. Jede Farbe traegt ihren Namen als Beschriftung -
           * sechs Flecken nebeneinander lassen sich weder vorlesen noch
           * benennen, und Rot neben Orange ist nicht fuer jeden ein
           * Unterschied. Belegte Farben sind gesperrt und sagen, bei wem sie
           * liegen; wer sie will, fragt ihn.
           */}
          <ul className="colors" aria-label="Deine Farbe">
            {SEAT_COLORS.map((color) => {
              const owner = room.seats.find((seat) => seat.color === color);
              const mine = owner?.userId === youId;
              const taken = owner !== undefined && !mine;

              return (
                <li key={color}>
                  <button
                    type="button"
                    className={mine ? 'colors__pick colors__pick--mine' : 'colors__pick'}
                    data-testid={`color-${color}`}
                    aria-pressed={mine}
                    disabled={taken || room.started}
                    title={
                      taken ? `${seatColorName(color)} hat ${owner.name}` : seatColorName(color)
                    }
                    onClick={() => onChooseColor(color)}
                  >
                    <SeatPiece color={color} />
                    <span className="colors__name">{seatColorName(color)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="lobby__setting" aria-label="Brett">
        <span className="eyebrow">Seed</span>
        <p className="lobby__seed">{room.seed}</p>
        <p className="lobby__hint">
          Gleicher Seed, gleiches Brett — bei euch und bei allen anderen.
        </p>
        {canConfigure ? (
          <button
            type="button"
            className="button button--ghost"
            onClick={() => onConfigure(room.seatCount, randomSeed(), room.victoryPointGoal)}
          >
            Neu würfeln
          </button>
        ) : null}
      </section>

      {/*
       * Das Siegpunktziel steht in einem eigenen Kasten und nicht beim Seed: es
       * ist die einzige Einstellung, die sagt, wie lange der Abend dauert.
       * Zehn ist die Zahl aus der Schachtel und bleibt die Vorgabe.
       */}
      <section className="lobby__setting" aria-label="Siegpunkte">
        <span className="eyebrow">Siegpunkte zum Sieg</span>
        <p className="lobby__goal" data-testid="goal">
          {room.victoryPointGoal}
        </p>
        {canConfigure ? (
          <div className="lobby__resize">
            <button
              type="button"
              className="button button--ghost"
              aria-label="Ein Siegpunkt weniger"
              disabled={room.victoryPointGoal <= MIN_VICTORY_POINT_GOAL}
              onClick={() => onConfigure(room.seatCount, room.seed, room.victoryPointGoal - 1)}
            >
              −
            </button>
            <button
              type="button"
              className="button button--ghost"
              aria-label="Ein Siegpunkt mehr"
              disabled={room.victoryPointGoal >= MAX_VICTORY_POINT_GOAL}
              onClick={() => onConfigure(room.seatCount, room.seed, room.victoryPointGoal + 1)}
            >
              +
            </button>
          </div>
        ) : null}
        <p className="lobby__hint">
          {room.victoryPointGoal === 10
            ? 'Zehn wie in der Schachtel.'
            : `Zwischen ${MIN_VICTORY_POINT_GOAL} und ${MAX_VICTORY_POINT_GOAL} — zehn sind die Vorgabe.`}
        </p>
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
 * Der freie Platz traegt seit Etappe 10 keine Farbe mehr, sondern
 * `currentColor`: welche Farbe der naechste bekommt, weiss man nicht mehr - er
 * sucht sie sich aus. Ein Umriss in einer Farbe, die dann jemand anders nimmt,
 * waere ein Versprechen, das der Wartebereich nicht halten kann.
 *
 * Farbe per `style` und nicht als Attribut: eine CSS-Regel schlaegt das
 * gleichnamige SVG-Praesentationsattribut, und genau daran ist in Etappe 3
 * jede gebaute Strasse unsichtbar geworden.
 */
export function SeatPiece({
  color,
  open = false,
}: {
  readonly color: string;
  readonly open?: boolean;
}): JSX.Element {
  return (
    <svg className="piece piece--seat" viewBox={VIEWBOX} aria-hidden="true">
      <path
        d={SETTLEMENT_PATH}
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
