import { useMemo, useState, type CSSProperties, type JSX } from 'react';
import {
  CLASSIC_34,
  CLASSIC_56,
  createGame,
  generateScenario,
  type GameState,
  type RoomSummary,
  citiesRulesFor,
  rulesFor,
  type ScenarioBlueprint,
  type RoomVariant,
} from '@conquerist/shared';
import { MAX_SEATS, MIN_SEATS, SEAT_COLORS, defaultSeats, type Seat } from '../seats';
import { BoardSvg } from '../board/BoardSvg';
import { SETTLEMENT_PATH, VIEWBOX } from '../board/shapes';
import { EMPTY_TARGETS } from '../game/targets';
import { ConnectionPanel } from '../diagnostics/ConnectionPanel';
import type { Identity } from '../game/useOnlineGame';
import { AccountCorner } from './AccountCorner';
import { HexField } from './HexField';
import { SeatPiece } from './LobbyScreen';

/** Tut nichts - Vorgabewert fuer die drei Konto-Aktionen ohne Identitaet. */
function noop(): void {
  // Bewusst leer: ohne `identity` rendert `AccountCorner` ohnehin `null`, und
  // diese Griffe werden nie aufgerufen.
}

/*
 * Hier stand `LocalOptions` mit einem einzigen Feld: ob die Handkarten beim
 * Zugwechsel zugedeckt werden. Es war die letzte Auswahl im Spiel, die wie ein
 * Formular aussah und nicht wie Spielmaterial - zwei nackte Optionsfelder
 * unter lauter gezeichneten Kacheln.
 *
 * **Sie ist weg, und die vorsichtige Antwort bleibt stehen.** Zugedeckt war
 * ohnehin die Vorgabe, und sie ist dieselbe Regel, nach der online gespielt
 * wird: Handkarten sind geheim (Regel 4). Wer zu zweit nebeneinander sitzt und
 * sowieso alles sieht, drueckt einmal mehr auf „Karten ansehen" - das ist ein
 * Klick, wo vorher eine Frage vor der Partie stand.
 */

/**
 * Die Wege in eine Partie - jeder ein Reiter.
 *
 * `resume` ist keiner der drei Wege, sondern die Rueckkehr in etwas
 * Angefangenes. Er steht trotzdem in derselben Reihe, weil er dieselbe Frage
 * beantwortet (wo geht es jetzt hin) und ein eigener Bereich darueber den
 * Bildschirm nur laenger machen wuerde.
 */
export type Way = 'online' | 'local' | 'join' | 'resume';

export interface StartScreenProps {
  /** An einem Geraet: die Partie beginnt sofort. */
  readonly onStartLocal: (game: GameState, seats: readonly Seat[]) => void;
  /*
   * `onCreateRoom` stand hier. Der Weg „online" fuehrt nicht mehr ueber diesen
   * Bildschirm: der Raum entsteht direkt vom Titel aus, weil alles, was hier
   * dafuer einzustellen war, im Wartebereich noch einmal steht (`App.tsx`).
   */
  readonly onJoinRoom: (code: string, name: string) => void;
  /** Aus `?raum=` in der Adresse - der Einladungslink. */
  readonly initialCode?: string | null;
  /** Was zuletzt schiefging; kommt von aussen, weil es dort passiert. */
  readonly problem?: string | null;
  /** Zuletzt benutzter Anzeigename. */
  readonly initialName?: string;
  /** Partien, an denen dieser Spieler sitzt. Leer heisst: der Reiter fehlt. */
  readonly myRooms?: readonly RoomSummary[];
  readonly onResume?: (code: string) => void;
  /**
   * Endgueltig aussteigen - die Karte verschwindet.
   *
   * Der Bildschirm fragt vorher nach, macht aber nichts selbst: was ein
   * Austritt bedeutet, entscheidet der Server (Platz frei oder Partie
   * abgebrochen), und der Client soll es nicht ein zweites Mal wissen.
   */
  readonly onAbandon?: (code: string) => void;
  /**
   * Wegraeumen statt abbrechen - nur, wo `deletable` es sagt.
   *
   * Der Bildschirm prueft nicht nach, wem der Tisch gehoert und wer noch daran
   * sitzt: das steht in der Zusammenfassung, weil der Server es durchsetzt.
   */
  readonly onDelete?: (code: string) => void;
  /** Wer angemeldet ist - fuer die Konto-Ecke oben rechts. */
  readonly identity?: Identity | null;
  readonly onRegister?: () => void;
  readonly onLogin?: () => void;
  readonly onLogout?: () => void;
  /**
   * Welcher Weg beim Aufschlagen offen ist - vom Titelbildschirm vorgewaehlt.
   *
   * Es ist ein **Anfangswert und keine Steuerung**: der Reiter bleibt danach
   * Sache dieses Bildschirms, sonst muesste der Titel den Zustand halten, den
   * er gar nicht mehr sieht. Ohne Angabe faengt der Bildschirm an, wo er immer
   * angefangen hat - dafuer gibt es weiter Aufrufer (die Tests).
   *
   * Er zaehlt zugleich als **getroffene Entscheidung**: wer vom Titel kommt,
   * hat gewaehlt, und der Sprung auf „Weiterspielen" (siehe `chosen`) darf ihm
   * den Reiter nicht unter der Hand wegziehen. Auf dem Titel steht
   * „Weiterspielen" ohnehin als eigener Eintrag.
   */
  readonly initialWay?: Way;
  /**
   * Zurueck zum Titel. Fehlt der Griff, fehlt der Knopf.
   *
   * Ein Ausgang, der ins Leere fuehrt, ist schlimmer als keiner - und es gibt
   * Aufrufer ohne Titel davor.
   */
  readonly onBack?: () => void;
}

const BLUEPRINTS: readonly ScenarioBlueprint[] = [CLASSIC_34, CLASSIC_56];

/**
 * Welche Bretter eine Tischgroesse tragen.
 *
 * Die Grenzen stehen im Blueprint (`minPlayers` / `maxPlayers`) und werden hier
 * gelesen, nicht wiederholt - sonst gaebe es zwei Wahrheiten, und `createGame`
 * wuerde mit Recht werfen.
 */
export function blueprintsFor(playerCount: number): readonly ScenarioBlueprint[] {
  return BLUEPRINTS.filter(
    (blueprint) => playerCount >= blueprint.minPlayers && playerCount <= blueprint.maxPlayers,
  );
}

/** Ein kurzer Vorschlag, den man abtippen und weitersagen kann. */
export function randomSeed(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(36).padStart(2, '0')).join('');
}

const SEAT_COUNTS = Array.from(
  { length: MAX_SEATS - MIN_SEATS + 1 },
  (_unused, index) => MIN_SEATS + index,
);

/**
 * Der Platz in der Eingangsreihe, als Zahl statt als eigene Klasse.
 *
 * Das CSS rechnet daraus die Verzoegerung (`calc(var(--i) * 65ms)`). Eine
 * Klasse je Verzoegerung waere dieselbe Auskunft, nur haendisch gepflegt - und
 * beim naechsten Element vergessen.
 */
function order(index: number): CSSProperties {
  return { '--i': index } as CSSProperties;
}

/**
 * Wo eine Partie anfaengt - und seit dem Wegfall des Hauptmenues der Eingang.
 *
 * Der Bildschirm zeigt **das Brett, das gleich gespielt wird** - erzeugt aus
 * dem Seed im Formular, neu bei jedem Tastendruck. Das ist keine Zierde: der
 * Seed ist sonst eine kryptische Zeichenkette, und so wird er zu etwas
 * Sichtbarem. Der Generator aus Etappe 1 braucht dafuer rund drei Millisekunden
 * je Brett; das traegt eine Vorschau, die am Tippen haengt.
 *
 * Der Vorschlag fuer den Seed kommt aus `crypto` - echter Zufall, und die
 * einzige Stelle im Projekt, an der das erlaubt ist. Regel 2 gilt fuer die
 * Logik; die Grenze zwischen Welt und Logik ist genau dieses Eingabefeld.
 *
 * **Zwei Wege, und die Verben sagen den Unterschied:** online wird eine Partie
 * *erstellt* - danach wartet man im Wartebereich auf die anderen. An einem
 * Geraet wird sie *gestartet* und laeuft sofort. Tischgroesse und Seed gelten
 * fuer beide, deshalb stehen sie ueber dem, was nur einen von beiden betrifft.
 *
 * **Warum die Wege Reiter sind und kein zweiter Bildschirm davor.** Bis hierher
 * stand ein Hauptmenue davor, das genau eine Frage stellte - welcher Weg - und
 * sie danach auf diesem Bildschirm noch einmal als Ueberschrift wiederholte.
 * Zwei Flaechen fuer eine Entscheidung, und die zweite trug die Antwort der
 * ersten nur vor. Als Reiter ist die Entscheidung an einer Stelle sichtbar,
 * bleibt umkehrbar, ohne dass jemand zurueckgeht - und der Bildschirm zeigt
 * immer nur einen Weg, was ihn kurz genug haelt, um ohne Scrollen zu passen.
 *
 * **Als Radiogruppe und nicht als ARIA-Reiter**, weil dasselbe Muster eine
 * Ebene tiefer schon einmal steht (die Tischgroesse) und weil es Tastatur und
 * Vorlesegeraet ohne Zutun richtig bedient. Ein zweites Bedienmuster fuer
 * dieselbe Sache waere Regel 8 auf der Bedienebene.
 *
 * Wortmarke, Hexfeld und die Eingangschoreografie kommen aus dem Hauptmenue
 * mit: sie gehoerten nie zu jenem Bildschirm, sondern zum **Eingang**, und der
 * ist jetzt hier. Die Marke ist aus demselben Winkel geschnitten wie das Brett
 * (`Wordmark.tsx`), das Feld dahinter mit den Funktionen des Bretts gezeichnet
 * (`HexField.tsx`) - kein Bild, das so aehnlich aussieht, sondern dasselbe
 * Material.
 */
export function StartScreen({
  onStartLocal,
  onJoinRoom,
  initialCode = null,
  problem = null,
  initialName = '',
  myRooms = [],
  onResume,
  onAbandon,
  onDelete,
  identity = null,
  onRegister = noop,
  onLogin = noop,
  onLogout = noop,
  initialWay,
  onBack,
}: StartScreenProps): JSX.Element {
  const [seats, setSeats] = useState<Seat[]>(() => defaultSeats(MIN_SEATS));
  const [seed, setSeed] = useState(randomSeed);

  /**
   * Nach welchem Regelwerk die lokale Partie laeuft.
   *
   * Nur hier - der Online-Weg fuehrt nicht ueber diesen Bildschirm, dort steht
   * die Wahl im Wartebereich.
   */
  const [variant, setVariant] = useState<RoomVariant>('classic');
  const [localProblem, setLocalProblem] = useState<string | null>(null);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [name, setName] = useState(initialName);
  const [code, setCode] = useState(initialCode ?? '');
  /*
   * Welche Karte gerade nachfragt, ob es ernst gemeint ist.
   *
   * Als Zustand auf diesem Bildschirm und nicht als `window.confirm`: der
   * Systemdialog haelt den ganzen Browser an, sieht auf jedem Rechner anders
   * aus und laesst sich nicht auf Deutsch beschriften. Die Frage gehoert
   * ausserdem auf die Karte, um die es geht - „Wirklich?" ohne sichtbaren
   * Bezug ist die Frage, bei der man auf gut Glueck klickt.
   */
  const [abandoning, setAbandoning] = useState<string | null>(null);

  /*
   * Welcher Reiter offen ist.
   *
   * Ein Einladungslink ist bereits eine Entscheidung: wer ihm gefolgt ist, will
   * beitreten und nichts anderes. Sonst faengt der Bildschirm beim Erstellen an.
   */
  /*
   * **Der Weg wird hier nicht mehr gewaehlt, er steht fest.**
   *
   * Er kam einmal aus einer Reiterreihe auf diesem Bildschirm, und der Titel
   * davor waehlte ihn bloss vor. Das waren zwei Orte fuer eine Entscheidung -
   * und der zweite hat sie nur wiederholt. Jetzt fuehrt der Titel geradewegs
   * hierher, und dieser Bildschirm ist der Bildschirm **dieses einen Weges**.
   * Wer den Weg wechseln will, geht zurueck; das ist ein Klick, genau wie der
   * Reiter einer war.
   *
   * Ein Einladungslink schlaegt alles: wer ihm gefolgt ist, will beitreten.
   */
  const way: Way = initialCode === null ? (initialWay ?? 'local') : 'join';

  /*
   * Bei drei bis vier Spielern passt nur `classic34`, bei fuenf bis sechs nur
   * `classic56` - die Auswahl haette also immer genau einen Eintrag. Deshalb
   * ist das Brett hier keine Wahl, sondern eine Angabe. `blueprintsFor` bleibt,
   * weil ein drittes Szenario daraus wieder eine Wahl macht.
   */
  const blueprint = blueprintsFor(seats.length)[0];

  /** Das Brett zum eingestellten Seed - dasselbe, das die Partie bekommt. */
  const preview = useMemo(() => {
    if (blueprint === undefined) return null;
    try {
      const scenario = generateScenario(blueprint, seed);
      return createGame(
        scenario,
        variant === 'cities' ? citiesRulesFor(seats.length) : rulesFor(seats.length),
        seats.map((entry) => entry.id),
        seed,
      );
    } catch {
      // Eine Vorschau, die nicht entsteht, darf den Bildschirm nicht mitnehmen.
      // Was schiefging, sagt beim Starten die Meldung aus `createGame`.
      return null;
    }
  }, [blueprint, seed, seats, variant]);

  const resize = (count: number): void => {
    // Bereits eingetragene Namen ueberleben das Vergroessern.
    setSeats(
      defaultSeats(count).map((seat, index) => ({
        ...seat,
        name: seats[index]?.name ?? seat.name,
      })),
    );
  };

  const rename = (index: number, name: string): void => {
    setSeats((current) =>
      current.map((seat, position) => (position === index ? { ...seat, name } : seat)),
    );
  };

  const startLocal = (): void => {
    if (blueprint === undefined) {
      setLocalProblem(`Für ${seats.length} Spieler gibt es kein passendes Brett`);
      return;
    }
    if (preview === null) {
      setLocalProblem('Das Brett zu diesem Seed lässt sich nicht bauen');
      return;
    }

    setLocalProblem(null);
    onStartLocal(preview, seats);
  };

  const shown = problem ?? localProblem;

  /*
   * Tischgroesse, Brett und Vorschau gehoeren jetzt nur noch der lokalen
   * Partie. Wer online erstellt, kommt gar nicht mehr hierher - der Raum
   * entsteht sofort, und alle drei Angaben stehen im Wartebereich. Wer
   * beitritt oder zurueckkehrt, hat sie noch nie gewaehlt: das bestimmt der,
   * der die Partie erstellt hat.
   */
  const showsBoard = way === 'local';
  const showsName = way === 'join';

  /*
   * Die Ueberschrift des Bildschirms - je Weg eine, und je Weg eine andere.
   *
   * Sie ersetzt die Reiterreihe: die sagte, **welche** Wege es gibt, und der
   * offene Reiter nebenbei, auf welchem man steht. Gebraucht wird nur das
   * Zweite. Der Bau ist der des Wartebereichs: Kleinlabel, darunter das eine
   * grosse Wort.
   */
  const heading: Readonly<Record<Way, { readonly eyebrow: string; readonly title: string }>> = {
    online: { eyebrow: 'Partie starten', title: 'Online' },
    local: { eyebrow: 'Partie starten', title: 'An einem Gerät' },
    join: { eyebrow: 'Partie beitreten', title: 'Raumcode' },
    resume: { eyebrow: 'Weiterspielen', title: 'Deine Partien' },
  };

  return (
    <main className="start">
      <HexField />

      {/* Die Ecke faellt zuletzt ein - ihr `--i` liegt deshalb hinter dem der
          Reiter und des Formulars. */}
      <AccountCorner
        identity={identity}
        onRegister={onRegister}
        onLogin={onLogin}
        onLogout={onLogout}
        order={2}
      />

      <section className="start__panel">
        {/*
         * Hier stand die Wortmarke. Sie steht jetzt auf dem Titelbildschirm
         * davor (`MenuScreen.tsx`) - **einmal**, und dort ist sie der Inhalt
         * und nicht die Kopfzeile eines Formulars. Zwei Bildschirme
         * hintereinander mit demselben Titel sind kein Wiedererkennen, sondern
         * eine Wiederholung.
         */}
        {onBack === undefined ? null : (
          /*
           * **„Zum Titel" und nicht „Zurueck".** Auf dem Weg „Weiterspielen"
           * steht auf jeder Karte „Zurueck in die Partie" beziehungsweise
           * „Zurueck an den Tisch" - zwei Knoepfe mit demselben ersten Wort,
           * die in entgegengesetzte Richtungen fuehren. Ein Wort bleibt durch
           * den ganzen Ablauf gleich (Regel 8), und „zurueck" gehoert hier
           * denen, die in eine Partie fuehren.
           */
          <button type="button" className="button button--ghost start__back" onClick={onBack}>
            <svg viewBox="0 0 10 10" aria-hidden="true">
              <path d="M7 1 L3 5 L7 9" />
            </svg>
            Zum Titel
          </button>
        )}

        <header className="start__head" style={order(0)}>
          <span className="eyebrow">{heading[way].eyebrow}</span>
          <h1 className="start__heading">{heading[way].title}</h1>
        </header>

        {/*
         * Ein Traeger fuer alles unter den Reitern, und zwar einer, der beim
         * Umschalten stehen bleibt. Nur so laeuft die Eingangsanimation genau
         * einmal: liefe sie an den ausgetauschten Teilen, spielte sie bei jedem
         * Reiterwechsel neu - Bewegung, die keinen Zustandswechsel erklaert,
         * sondern ihn bloss begleitet (Regel 5).
         */}
        <div className="start__form" style={order(1)}>
          {showsBoard ? (
            <fieldset className="field-group">
              <legend>Spieler</legend>
              <div className="seatcount">
                {SEAT_COUNTS.map((count) => (
                  <span key={count}>
                    <input
                      id={`seatcount-${count}`}
                      type="radio"
                      name="seatcount"
                      aria-label={`${count} Spieler`}
                      checked={seats.length === count}
                      onChange={() => resize(count)}
                    />
                    <label htmlFor={`seatcount-${count}`}>{count}</label>
                  </span>
                ))}
              </div>
            </fieldset>
          ) : null}

          {showsBoard ? (
            <fieldset className="field-group">
              {/*
               * Dieselbe Wahl wie im Wartebereich, und aus demselben Grund
               * dieselbe Form: zwei Moeglichkeiten, zwei Knoepfe. Sie steht
               * hier vor dem Seed, weil sie bestimmt, was das Brett traegt -
               * und die Vorschau daneben rechnet mit ihr.
               */}
              <legend>Regelwerk</legend>
              <div className="variantpick">
                {(['classic', 'cities'] as const).map((choice) => (
                  <span key={choice}>
                    <input
                      id={`variant-${choice}`}
                      type="radio"
                      name="variant"
                      aria-label={choice === 'cities' ? 'Städte & Ritter' : 'Basisspiel'}
                      checked={variant === choice}
                      onChange={() => setVariant(choice)}
                    />
                    <label htmlFor={`variant-${choice}`}>
                      {choice === 'cities' ? 'Städte & Ritter' : 'Basisspiel'}
                    </label>
                  </span>
                ))}
              </div>
            </fieldset>
          ) : null}

          {showsBoard ? (
            <fieldset className="field-group">
              <legend>Seed</legend>
              <div className="seedrow">
                <input
                  aria-label="Seed"
                  value={seed}
                  maxLength={24}
                  onChange={(event) => setSeed(event.currentTarget.value)}
                />
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => setSeed(randomSeed())}
                >
                  Neu würfeln
                </button>
              </div>
              {/*
               * Nur noch der Brettname.
               *
               * Dahinter stand „- gleicher Seed, gleiches Brett". Der Satz
               * erklaerte, was die Vorschau daneben **zeigt**: wer den Seed
               * aendert, sieht das Brett sich aendern, und wer ihn stehen
               * laesst, sieht es stehen bleiben. Eine Zusage neben ihrem
               * eigenen Beweis ist eine Zeile zu viel.
               */}
              <p className="start__note">{blueprint?.name ?? 'Kein passendes Brett'}</p>
            </fieldset>
          ) : null}

          {shown === null ? null : <p className="error">{shown}</p>}

          {/*
           * Der Name steht bei beiden Online-Wegen, deshalb einmal davor. Wer
           * erstellt und wer beitritt, braucht ihn gleichermassen - zweimal
           * dasselbe Feld waeren zwei Orte fuer eine Angabe.
           */}
          {showsName ? (
            <fieldset className="field-group">
              <legend>Dein Name</legend>
              <input
                id="displayname"
                aria-label="Dein Name"
                value={name}
                maxLength={16}
                placeholder="Anna"
                onChange={(event) => setName(event.currentTarget.value)}
              />
            </fieldset>
          ) : null}

          {way === 'join' ? (
            <section className="way">
              <p className="way__lead">Vier Zeichen, vorgelesen oder aus dem Einladungslink.</p>

              <div className="seedrow">
                <input
                  aria-label="Raumcode"
                  value={code}
                  maxLength={4}
                  placeholder="K7X2"
                  onChange={(event) => setCode(event.currentTarget.value.toUpperCase())}
                />
                <button
                  type="button"
                  className="button"
                  // Aus dem Einladungslink gekommen: der Code steht schon da, es
                  // fehlt nur noch der Griff zur Maus.
                  autoFocus={initialCode !== null}
                  disabled={code.trim().length !== 4 || name.trim() === ''}
                  onClick={() => onJoinRoom(code.trim(), name.trim())}
                >
                  Beitreten
                </button>
              </div>
            </section>
          ) : null}

          {way === 'local' ? (
            <section className="way">
              <p className="way__lead">Alle am selben Bildschirm, reihum.</p>

              <ol className="seats">
                {seats.map((seat, index) => (
                  <li key={seat.id}>
                    <PieceMark color={SEAT_COLORS[index] ?? seat.color} />
                    <input
                      aria-label={`Name von Spieler ${index + 1}`}
                      value={seat.name}
                      maxLength={16}
                      onChange={(event) => rename(index, event.currentTarget.value)}
                    />
                  </li>
                ))}
              </ol>

              <button type="button" className="button" onClick={startLocal}>
                Lokale Partie starten
              </button>
            </section>
          ) : null}

          {way === 'resume' ? (
            <section className="way">
              <span className="eyebrow">Deine Partien</span>
              <ol className="resume">
                {myRooms.map((entry) => (
                  <li key={entry.code} className="resume__card">
                    <div className="resume__head">
                      <span className="resume__code">{entry.code}</span>
                      <span className="resume__state">
                        {!entry.started
                          ? `wartet · ${entry.seats.length} von ${entry.seatCount}`
                          : entry.yourTurn === true
                            ? `Runde ${entry.turn ?? 0} · du bist dran`
                            : `Runde ${entry.turn ?? 0}`}
                      </span>
                    </div>

                    <div className="resume__seats">
                      {entry.seats.map((seat) => (
                        <span key={seat.name} className="resume__seat">
                          <SeatPiece color={seat.color} open={!seat.connected} />
                          {seat.name}
                        </span>
                      ))}
                    </div>

                    {abandoning === entry.code ? (
                      <div className="resume__confirm" role="group">
                        <p className="resume__warning">{exitWarning(entry)}</p>
                        <div className="resume__actions">
                          <button
                            type="button"
                            className="button button--no"
                            onClick={() => {
                              setAbandoning(null);
                              if (entry.deletable) onDelete?.(entry.code);
                              else onAbandon?.(entry.code);
                            }}
                          >
                            {`Ja, ${exitVerb(entry).toLocaleLowerCase('de')}`}
                          </button>
                          <button
                            type="button"
                            className="button button--ghost"
                            onClick={() => setAbandoning(null)}
                          >
                            Doch nicht
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="resume__actions">
                        <button
                          type="button"
                          className="button"
                          onClick={() => onResume?.(entry.code)}
                        >
                          {entry.started ? 'Zurück in die Partie' : 'Zurück an den Tisch'}
                        </button>
                        {onAbandon === undefined ? null : (
                          <button
                            type="button"
                            className="button button--ghost"
                            onClick={() => setAbandoning(entry.code)}
                          >
                            {entry.deletable
                              ? 'Partie löschen'
                              : entry.started
                                ? 'Partie abbrechen'
                                : 'Tisch verlassen'}
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {/*
           * Der Inhalt wird erst erzeugt, wenn das Feld offen ist - und nicht
           * bloss ausgeblendet. `details` versteckt seine Kinder nur optisch;
           * sie waeren gerendert, `useConnection` liefe, und eine
           * Hotseat-Partie haette eine WebSocket-Verbindung, die sie nicht
           * braucht. Ein Test haelt das fest.
           */}
          <details
            className="start__diagnostics"
            open={diagnosticsOpen}
            onToggle={(event) => setDiagnosticsOpen(event.currentTarget.open)}
          >
            <summary>Verbindung und Diagnose (Etappe 0)</summary>
            {diagnosticsOpen ? <ConnectionPanel /> : null}
          </details>
        </div>
      </section>

      {/*
       * Die rechte Haelfte gibt es nur, wo es ein Brett zu zeigen gibt.
       *
       * **Die Bildunterschrift stand einmal ausserhalb dieser Bedingung**, und
       * im Browser las man auf dem Beitreten-Bildschirm „Euer Brett zum Seed
       * 2v4c305c" - unter einer leeren Flaeche, ueber ein Brett, das niemand
       * bekommt: der Seed gehoert dort dem, der die Partie erstellt hat, und
       * die Zeichenkette daneben war die des eigenen Formulars, das gar nicht
       * mehr sichtbar war. Eine Unterschrift ohne Bild beschreibt irgendetwas.
       */}
      {!showsBoard ? null : (
        <div className="start__preview">
          {preview === null ? null : (
            <BoardSvg
              state={preview}
              targets={EMPTY_TARGETS}
              seats={seats}
              onPick={() => {
                /* Die Vorschau ist zum Ansehen da, nicht zum Spielen. */
              }}
            />
          )}
        </div>
      )}
    </main>
  );
}

/**
 * Wie der Ausgang aus dieser Partie heisst.
 *
 * Drei Faelle und drei Verben, weil es drei verschiedene Vorgaenge sind:
 * loeschen raeumt weg (der Tisch gehoert mir und sonst sitzt niemand mehr
 * daran), abbrechen beendet fuer alle, verlassen gibt bloss einen Platz frei.
 * Ein gemeinsames „Entfernen" waere ein Wort, das drei Dinge meint.
 *
 * Ob geloescht werden darf, steht in `deletable` und wird hier nicht
 * nachgerechnet - die Regel gehoert dem Server.
 */
function exitVerb(room: RoomSummary): string {
  if (room.deletable) return 'Löschen';
  return room.started ? 'Abbrechen' : 'Verlassen';
}

/** Was der Klick anrichtet - ein Satz, und zwar vor der Entscheidung. */
function exitWarning(room: RoomSummary): string {
  if (room.deletable) {
    return 'Die Partie wird mit ihrem ganzen Verlauf gelöscht und kommt nicht wieder.';
  }
  return room.started
    ? 'Die Partie ist danach für alle am Tisch vorbei und zählt als abgebrochen.'
    : 'Dein Platz an diesem Tisch wird wieder frei.';
}

/**
 * Die Siedlung aus dem Brett, klein - damit die Spielerfarbe hier dieselbe
 * Form hat wie spaeter auf dem Feld.
 */
function PieceMark({ color }: { readonly color: string }): JSX.Element {
  return (
    <svg className="piece" viewBox={VIEWBOX} aria-hidden="true">
      <path
        d={SETTLEMENT_PATH}
        style={{ fill: color, stroke: '#16202a' }}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </svg>
  );
}
