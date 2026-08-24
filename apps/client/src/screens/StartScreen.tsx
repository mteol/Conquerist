import { useEffect, useMemo, useRef, useState, type CSSProperties, type JSX } from 'react';
import {
  CLASSIC_34,
  CLASSIC_56,
  CLASSIC_RULES,
  createGame,
  generateScenario,
  type GameState,
  type RoomSummary,
  type ScenarioBlueprint,
} from '@conquerist/shared';
import { MAX_SEATS, MIN_SEATS, SEAT_COLORS, defaultSeats, type Seat } from '../seats';
import { BoardSvg } from '../board/BoardSvg';
import { SETTLEMENT_PATH, VIEWBOX } from '../board/shapes';
import { EMPTY_TARGETS } from '../game/targets';
import { ConnectionPanel } from '../diagnostics/ConnectionPanel';
import type { Identity } from '../game/useOnlineGame';
import { AccountCorner } from './AccountCorner';
import { HexField } from './HexField';
import { Wordmark } from './Wordmark';
import { SeatPiece } from './LobbyScreen';

/** Tut nichts - Vorgabewert fuer die drei Konto-Aktionen ohne Identitaet. */
function noop(): void {
  // Bewusst leer: ohne `identity` rendert `AccountCorner` ohnehin `null`, und
  // diese Griffe werden nie aufgerufen.
}

/** Was nur die lokale Partie betrifft - online gibt es diese Fragen nicht. */
export interface LocalOptions {
  /**
   * Handkarten beim Zugwechsel zudecken.
   *
   * Am selben Geraet ist das eine echte Frage: der Bildschirm wandert weiter.
   * Wer zu zweit nebeneinander sitzt und ohnehin alles sieht, will den
   * Zwischenschritt nicht - deshalb eine Wahl und keine Vorschrift.
   */
  readonly concealBetweenTurns: boolean;
}

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
  readonly onStartLocal: (game: GameState, seats: readonly Seat[], options: LocalOptions) => void;
  /** Online: es entsteht ein Raum, gespielt wird spaeter. */
  readonly onCreateRoom: (seatCount: number, seed: string, name: string) => void;
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
  /** Wer angemeldet ist - fuer die Konto-Ecke oben rechts. */
  readonly identity?: Identity | null;
  readonly onRegister?: () => void;
  readonly onLogin?: () => void;
  readonly onLogout?: () => void;
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
  onCreateRoom,
  onJoinRoom,
  initialCode = null,
  problem = null,
  initialName = '',
  myRooms = [],
  onResume,
  onAbandon,
  identity = null,
  onRegister = noop,
  onLogin = noop,
  onLogout = noop,
}: StartScreenProps): JSX.Element {
  const [seats, setSeats] = useState<Seat[]>(() => defaultSeats(MIN_SEATS));
  const [seed, setSeed] = useState(randomSeed);
  const [localProblem, setLocalProblem] = useState<string | null>(null);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [name, setName] = useState(initialName);
  const [code, setCode] = useState(initialCode ?? '');
  const [conceal, setConceal] = useState(true);
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
  const [way, setWay] = useState<Way>(initialCode === null ? 'online' : 'join');

  /*
   * Ob der Reiter von Hand gewaehlt wurde.
   *
   * `myRooms` kommt vom Server und ist beim ersten Rendern noch leer. Trifft
   * die Liste ein und es steht eine Partie offen, gehoert der Bildschirm
   * dorthin - wer schon irgendwo sitzt, will meistens zurueck. Aber nur,
   * solange niemand selbst gewaehlt hat: einen Reiter unter der Hand
   * wegzuziehen, waehrend jemand seinen Namen eintippt, waere schlimmer als die
   * falsche Voreinstellung.
   */
  const chosen = useRef(initialCode !== null);

  useEffect(() => {
    if (!chosen.current && myRooms.length > 0) setWay('resume');
  }, [myRooms.length]);

  const choose = (next: Way): void => {
    chosen.current = true;
    setWay(next);
  };

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
        CLASSIC_RULES,
        seats.map((entry) => entry.id),
        seed,
      );
    } catch {
      // Eine Vorschau, die nicht entsteht, darf den Bildschirm nicht mitnehmen.
      // Was schiefging, sagt beim Starten die Meldung aus `createGame`.
      return null;
    }
  }, [blueprint, seed, seats]);

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
    onStartLocal(preview, seats, { concealBetweenTurns: conceal });
  };

  const shown = problem ?? localProblem;

  /* Wer beitritt oder zurueckkehrt, waehlt weder Tischgroesse noch Brett -
     beides bestimmt der, der die Partie erstellt hat. */
  const showsBoard = way === 'online' || way === 'local';
  const showsName = way === 'online' || way === 'join';

  /*
   * Die Reiter. Wortlaut wie im ganzen Ablauf: Partie, nicht Spiel (Regel 8).
   * Die Beschriftung ist kurz, weil vier davon nebeneinander stehen; der ganze
   * Satz steht als zugaenglicher Name daneben, damit ein Vorlesegeraet nicht
   * bloss "online" vorliest.
   */
  const ways: readonly { readonly id: Way; readonly label: string; readonly title: string }[] = [
    { id: 'online', label: 'Online', title: 'Partie starten — online' },
    { id: 'local', label: 'Lokal', title: 'Partie starten — lokal' },
    { id: 'join', label: 'Beitreten', title: 'Partie beitreten' },
    ...(myRooms.length === 0
      ? []
      : [
          {
            id: 'resume' as const,
            label: `Weiterspielen (${myRooms.length})`,
            title: `Weiterspielen (${myRooms.length})`,
          },
        ]),
  ];

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
        <header className="start__brand">
          <h1 className="start__title">
            <Wordmark animated />
            {/*
             * Der Titel als Text, nur unsichtbar: die Ueberschrift braucht
             * einen zugaenglichen Namen, und der darf nicht aus Pfaddaten
             * erraten werden muessen.
             */}
            <span className="visually-hidden">Conquerist</span>
          </h1>
          <p className="start__lead">Drei bis sechs Spieler. Sechs Geräte oder eins.</p>
        </header>

        <fieldset className="field-group start__ways" style={order(0)}>
          <legend className="visually-hidden">Weg in eine Partie</legend>
          <div className="ways">
            {ways.map((entry) => (
              <span key={entry.id}>
                <input
                  id={`way-${entry.id}`}
                  type="radio"
                  name="way"
                  aria-label={entry.title}
                  checked={way === entry.id}
                  onChange={() => choose(entry.id)}
                />
                <label htmlFor={`way-${entry.id}`}>{entry.label}</label>
              </span>
            ))}
          </div>
        </fieldset>

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
               * Brettname und Seed-Zusage stehen in einer Zeile statt in zwei
               * Bloecken. Es ist dieselbe Auskunft - welches Brett ihr bekommt -
               * und zwei Zeilen dafuer waren zwei Zeilen zu viel fuer ein
               * Querformat mit 360 px Hoehe.
               */}
              <p className="start__note">
                {blueprint?.name ?? 'Kein passendes Brett'} — gleicher Seed, gleiches Brett.
              </p>
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

          {way === 'online' ? (
            <section className="way">
              <p className="way__lead">Jeder an seinem Gerät. Beitritt über Code oder Link.</p>

              <button
                type="button"
                className="button button--go"
                disabled={name.trim() === ''}
                onClick={() => onCreateRoom(seats.length, seed, name.trim())}
              >
                Partie erstellen
              </button>
            </section>
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

              <fieldset className="field-group way__hand">
                <legend>Handkarten</legend>
                <label htmlFor="hand-conceal">
                  <input
                    id="hand-conceal"
                    type="radio"
                    name="hand"
                    checked={conceal}
                    onChange={() => setConceal(true)}
                  />
                  Beim Zugwechsel zudecken
                </label>
                <label htmlFor="hand-open">
                  <input
                    id="hand-open"
                    type="radio"
                    name="hand"
                    checked={!conceal}
                    onChange={() => setConceal(false)}
                  />
                  Offen liegen lassen
                </label>
              </fieldset>

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
                        <p className="resume__warning">
                          {entry.started
                            ? 'Die Partie ist danach für alle am Tisch vorbei und zählt als abgebrochen.'
                            : 'Dein Platz an diesem Tisch wird wieder frei.'}
                        </p>
                        <div className="resume__actions">
                          <button
                            type="button"
                            className="button button--no"
                            onClick={() => {
                              setAbandoning(null);
                              onAbandon?.(entry.code);
                            }}
                          >
                            {entry.started ? 'Ja, abbrechen' : 'Ja, verlassen'}
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
                            {entry.started ? 'Partie abbrechen' : 'Tisch verlassen'}
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

      <div className="start__preview">
        {preview === null || !showsBoard ? null : (
          <BoardSvg
            state={preview}
            targets={EMPTY_TARGETS}
            seats={seats}
            onPick={() => {
              /* Die Vorschau ist zum Ansehen da, nicht zum Spielen. */
            }}
          />
        )}
        <p className="start__caption">
          Euer Brett zum Seed
          <b>{seed === '' ? '—' : seed}</b>
        </p>
      </div>
    </main>
  );
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
