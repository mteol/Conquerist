import { useEffect, useMemo, useState, type JSX } from 'react';
import {
  MAX_SEATS,
  MAX_VICTORY_POINT_GOAL,
  MIN_SEATS,
  MIN_VICTORY_POINT_GOAL,
  SEAT_COLORS,
  createGame,
  generateScenario,
  rulesFor,
  seatColorName,
  type RoomEvent,
} from '@conquerist/shared';
import { BoardSvg } from '../board/BoardSvg';
import { SETTLEMENT_PATH, VIEWBOX } from '../board/shapes';
import { EMPTY_TARGETS } from '../game/targets';
import { invitationLink } from '../net/session';
import { defaultSeats } from '../seats';
import { blueprintsFor, randomSeed } from './StartScreen';

/**
 * Der Wartebereich.
 *
 * **Rolle:** Die einzige Flaeche im Spiel, auf der es nichts zu tun gibt ausser
 * warten. Ihre Aufgabe ist deshalb genau zwei Dinge: den Code weitergeben und
 * zeigen, wer schon da ist.
 *
 * **Aufbau:** Der Raumcode ist das groesste Element der ganzen Anwendung - vier
 * Zeichen auf Pergament, weit gesperrt, damit er sich vorlesen laesst. Darunter
 * der Einladungslink zum Kopieren, dann **zwei Spalten** - links der Tisch,
 * rechts die Einstellungen -, unten die eine Handlung.
 *
 * **Und er passt ohne Scrollen.** Das ist keine Vorliebe, sondern die
 * Anforderung, aus der die zwei Spalten ueberhaupt entstanden sind: als eine
 * Spalte war der Bildschirm rund 1300 Pixel hoch, und „Partie starten" lag in
 * einem gewoehnlichen Fenster unterhalb des Randes. Auf der einzigen Flaeche
 * des Spiels, auf der es nichts zu tun gibt ausser warten, war damit die eine
 * Handlung, die es doch gibt, unsichtbar. Wer hier etwas hinzufuegt, sieht
 * nach, ob das noch stimmt.
 *
 * **Die drei Einstellungen sind eine Liste und keine drei Kaesten.** Name,
 * Brett und Ziel standen in drei gleich gebauten Kaesten untereinander, jeder
 * mit eigener Umrandung, eigenem Polster und mittiger Setzung - das sagt „drei
 * gleich wichtige Dinge", und es sind drei Zeilen. Als Zeilen brauchen sie ein
 * Drittel der Hoehe und lesen sich in einem Blick.
 *
 * **Was erklaert wurde, steht nicht mehr da.** Unter dem Seed stand „Gleicher
 * Seed, gleiches Brett - bei euch und bei allen anderen", unter dem Ziel je
 * nach Zahl „Zehn wie in der Schachtel" oder „Zwischen 5 und 20 - zehn sind
 * die Vorgabe". Zwei Formulierungen fuer dieselbe Auskunft, und die Grenzen
 * stehen ohnehin an den Knoepfen: wer bei 5 angekommen ist, findet das Minus
 * gesperrt vor. Uebrig bleibt „10 sind das Original" - das eine, was man
 * nicht sehen kann.
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

  /*
   * Der Seed im Feld gehoert dem Feld, solange jemand darin tippt - genau wie
   * der Name darueber, und aus demselben Grund: ein `onChange`, das jeden
   * Tastendruck schickt, waere eine Nachricht je Buchstabe, ein Raumstand je
   * Nachricht und ein neu gewuerfeltes Brett je Zeichen.
   *
   * **Er ist hier, weil der Einrichtungsbildschirm gegangen ist.** Dort liess
   * sich ein Seed eintippen, und das ist die einzige Art, ein bestimmtes Brett
   * wiederzubekommen - „Neu wuerfeln" allein kann das nicht. Wer einen
   * Bildschirm streicht, nimmt mit, was nur er konnte.
   */
  const [seed, setSeed] = useState(room.seed);
  useEffect(() => {
    setSeed(room.seed);
  }, [room.seed]);

  const commitSeed = (): void => {
    const trimmed = seed.trim();
    if (trimmed === '' || trimmed === room.seed) {
      setSeed(room.seed);
      return;
    }
    onConfigure(room.seatCount, trimmed, room.victoryPointGoal);
  };

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

  /*
   * Das Brett zum eingestellten Seed - dasselbe, das die Partie bekommt.
   *
   * **Wortwoertlich dasselbe:** `generateScenario` ist rein und haengt nur an
   * Blueprint und Seed (Regel 2), und beide stehen im Raumstand. Es ist keine
   * Zeichnung, die so aehnlich aussieht wie das spaetere Brett - es ist das
   * spaetere Brett, mit denselben Funktionen erzeugt wie auf dem
   * Startbildschirm. Zwei Wege zu einem Bild waeren zwei Gelegenheiten, dass
   * eines davon luegt.
   *
   * Erst dadurch bedeutet „Neu wuerfeln" hier etwas. Der Knopf stand seit
   * Etappe 10 an einer Zeichenkette: er aenderte sichtbar acht Zeichen und
   * unsichtbar das ganze Spiel.
   */
  const blueprint = blueprintsFor(room.seatCount)[0];

  const preview = useMemo(() => {
    if (blueprint === undefined) return null;

    try {
      const scenario = generateScenario(blueprint, room.seed);
      return createGame(
        scenario,
        rulesFor(room.seatCount),
        defaultSeats(room.seatCount).map((seat) => seat.id),
        room.seed,
      );
    } catch {
      // Eine Vorschau, die nicht entsteht, darf den Wartebereich nicht
      // mitnehmen - man wartet hier, man baut nicht.
      return null;
    }
  }, [blueprint, room.seed, room.seatCount]);

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
      <section className="lobby__panel">
        <header className="lobby__head">
          <span className="eyebrow">Raumcode</span>
          <p className="lobby__code">{room.code}</p>
          <div className="lobby__invite">
            <input readOnly aria-label="Einladungslink" value={invitationLink(room.code)} />
            <button type="button" className="button button--ghost" onClick={copyLink}>
              {copied ? 'Kopiert' : 'Link kopieren'}
            </button>
          </div>
        </header>

        {/*
         * Zwei Spalten: links, wer da ist - rechts, was eingestellt ist.
         *
         * **Der Grund ist gemessen und nicht gestalterisch.** Als eine Spalte war
         * der Wartebereich rund 1300 Pixel hoch und passte in kein Fenster; man
         * musste an den Mitspielern vorbeiscrollen, um den Startknopf zu finden.
         * Das ist auf dem einen Bildschirm, auf dem es nichts zu tun gibt ausser
         * warten, der schlechteste Fehler von allen - die eine Handlung lag
         * unterhalb des Randes.
         *
         * Die Aufteilung folgt derselben Frage wie der Startbildschirm: links das
         * Bedienbare, rechts das Eingestellte. Wer im engen Fenster sitzt,
         * bekommt beide Spalten wieder untereinander.
         */}
        <div className="lobby__body">
          <section className="lobby__table" aria-label="Am Tisch">
            <span className="eyebrow">Am Tisch</span>
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
           * Die Einstellungen als **eine** Liste und nicht als drei Kaesten.
           *
           * Drei Kaesten mit derselben Umrandung, demselben Polster und derselben
           * mittigen Setzung sagen: drei gleich wichtige Dinge. Es sind aber drei
           * Zeilen einer Liste - Name, Brett, Ziel -, und als Zeilen brauchen sie
           * ein Drittel der Hoehe und lesen sich in einem Blick von oben nach
           * unten statt in drei Anlaeufen.
           *
           * Was jedem selbst gehoert, steht trotzdem zuoberst und nicht dazwischen:
           * Name und Farbe darf jeder aendern, Brett und Ziel nur der Host.
           */}
          <div className="lobby__settings">
            {you === undefined ? null : (
              <section className="lobby__row" aria-label="Du">
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
                            taken
                              ? `${seatColorName(color)} hat ${owner.name}`
                              : seatColorName(color)
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

            <section className="lobby__row" aria-label="Brett">
              <span className="eyebrow">Seed</span>
              <div className="lobby__value">
                {canConfigure ? (
                  <input
                    className="lobby__seedfield"
                    aria-label="Seed"
                    value={seed}
                    maxLength={24}
                    onChange={(event) => setSeed(event.currentTarget.value)}
                    onBlur={commitSeed}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') event.currentTarget.blur();
                    }}
                  />
                ) : (
                  <p className="lobby__seed">{room.seed}</p>
                )}
                {canConfigure ? (
                  <button
                    type="button"
                    className="button button--ghost"
                    onClick={() => onConfigure(room.seatCount, randomSeed(), room.victoryPointGoal)}
                  >
                    Neu würfeln
                  </button>
                ) : null}
              </div>
            </section>

            {/*
             * Das Siegpunktziel ist die einzige Einstellung, die sagt, wie lange
             * der Abend dauert. Zehn ist die Zahl aus der Schachtel und bleibt die
             * Vorgabe; das steht als kurzer Zusatz daneben und nicht als Satz, der
             * je nach eingestellter Zahl etwas anderes erklaert.
             */}
            <section className="lobby__row" aria-label="Siegpunkte">
              <span className="eyebrow">Siegpunkte zum Sieg</span>
              <div className="lobby__value">
                <p className="lobby__goal" data-testid="goal">
                  {room.victoryPointGoal}
                </p>
                <span className="lobby__origin">10 sind das Original</span>
                {canConfigure ? (
                  <div className="lobby__resize">
                    <button
                      type="button"
                      className="button button--ghost"
                      aria-label="Ein Siegpunkt weniger"
                      disabled={room.victoryPointGoal <= MIN_VICTORY_POINT_GOAL}
                      onClick={() =>
                        onConfigure(room.seatCount, room.seed, room.victoryPointGoal - 1)
                      }
                    >
                      −
                    </button>
                    <button
                      type="button"
                      className="button button--ghost"
                      aria-label="Ein Siegpunkt mehr"
                      disabled={room.victoryPointGoal >= MAX_VICTORY_POINT_GOAL}
                      onClick={() =>
                        onConfigure(room.seatCount, room.seed, room.victoryPointGoal + 1)
                      }
                    >
                      +
                    </button>
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        </div>

        {/*
         * Die eine Handlung und der Ausgang stehen nebeneinander und nicht
         * untereinander: zwei Zeilen fuer zwei Knoepfe waren zwei Zeilen zu viel
         * fuer einen Bildschirm, der ohne Scrollen passen soll - und der Rang
         * steht ohnehin in der Farbe, nicht in der Reihenfolge.
         */}
        <footer className="lobby__foot">
          <div className="lobby__actions">
            {youAreHost ? (
              <button
                type="button"
                className="button button--go"
                disabled={missing > 0}
                onClick={onStart}
              >
                Partie starten
              </button>
            ) : null}
            <button type="button" className="button button--ghost" onClick={onLeave}>
              Tisch verlassen
            </button>
          </div>

          {/*
           * **Nur noch fuer die, die nicht starten koennen.**
           *
           * Hier stand fuer den Gastgeber „Es fehlen noch 3 Mitspieler" - eine
           * Zahl, die drei Zentimeter darueber schon als drei gestrichelte
           * Plaetze dasteht, und zwar besser: man sieht sie, ohne zu lesen. Der
           * gesperrte Startknopf sagt dasselbe ein zweites Mal. Dreimal
           * dieselbe Auskunft ist keine Betonung, sondern eine Zeile zu viel.
           *
           * Fuer alle anderen bleibt der Satz, denn er sagt etwas, das nirgends
           * sonst steht: **wer** starten muss. Wer der Gastgeber ist, ist der
           * Sitzliste nicht anzusehen.
           */}
          {youAreHost ? null : (
            <p className="lobby__hint">
              Wartet auf {host?.name ?? 'die Person, die den Raum erstellt hat'}.
            </p>
          )}
        </footer>
      </section>

      {/*
       * Die rechte Haelfte - und der Grund, warum die linke enger geworden ist.
       *
       * Sie ist zum Ansehen da: kein `onPick`, keine Ziele, keine Sitzfarben,
       * die etwas bedeuten wuerden (es steht noch nichts auf dem Brett). Was
       * sie zeigt, ist die Antwort auf die Frage, die im Wartebereich sonst
       * offen bleibt - worauf spielen wir gleich.
       */}
      <div className="lobby__preview">
        {preview === null ? null : (
          <BoardSvg
            state={preview}
            targets={EMPTY_TARGETS}
            seats={defaultSeats(room.seatCount)}
            onPick={() => {
              /* Die Vorschau ist zum Ansehen da, nicht zum Spielen. */
            }}
          />
        )}
      </div>
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
