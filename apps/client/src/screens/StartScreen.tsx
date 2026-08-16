import { useMemo, useState, type JSX } from 'react';
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
  /** Partien, an denen dieser Spieler sitzt. Leer heisst: der Bereich fehlt. */
  readonly myRooms?: readonly RoomSummary[];
  readonly onResume?: (code: string) => void;
  /**
   * Welcher Weg gemeint ist - kommt aus dem Hauptmenue.
   *
   * Ohne Angabe stehen wie bisher alle nebeneinander. Mit Angabe zeigt der
   * Bildschirm nur den gewaehlten: wer im Menue „Lokal spielen" gedrueckt hat,
   * hat die Entscheidung schon getroffen und soll sie hier nicht noch einmal
   * vorgelegt bekommen.
   */
  readonly mode?: 'online' | 'local' | 'join' | 'all';
  /** Zurueck ins Hauptmenue. Fehlt, wenn es keines gibt. */
  readonly onBack?: () => void;
  /**
   * Wer angemeldet ist - fuer die Konto-Ecke oben rechts, wie im Hauptmenue.
   *
   * Ohne Eingangsanimation: dieser Bildschirm hatte nie eine Choreografie,
   * und ein `order` gaebe es nur fuer eine, die es hier nicht gibt.
   */
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
 * Wo eine Partie anfaengt.
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
 * **Seit Etappe 4 zwei Wege, und die Verben sagen den Unterschied:** online
 * wird eine Partie *erstellt* - danach wartet man im Wartebereich auf die
 * anderen. An einem Geraet wird sie *gestartet* und laeuft sofort. Tischgroesse
 * und Seed gelten fuer beide Wege, deshalb stehen sie oben und nicht in einem
 * der beiden Kaesten.
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
  mode = 'all',
  onBack,
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

  const showsOnline = mode === 'all' || mode === 'online';
  const showsLocal = mode === 'all' || mode === 'local';
  const showsJoin = mode === 'all' || mode === 'join';
  /* Wer nur beitritt, waehlt weder Tischgroesse noch Brett - beides bestimmt
     der, der die Partie erstellt hat. */
  const showsBoard = showsOnline || showsLocal;

  /*
   * Wortgleich mit dem Menueeintrag, ueber den man hergekommen ist: wer
   * „Partie beitreten" gedrueckt hat, liest hier dasselbe und nicht ein zweites
   * Wort fuer dieselbe Sache (Regel 8).
   */
  const heading =
    mode === 'local'
      ? 'Partie starten — lokal'
      : mode === 'join'
        ? 'Partie beitreten'
        : 'Partie starten — online';

  return (
    <main className="start">
      {/* Dieselbe Ecke wie im Hauptmenue, ohne `order`: dieser Bildschirm
          hat keinen Eingang, den sie nachzeichnen muesste. */}
      <AccountCorner
        identity={identity}
        onRegister={onRegister}
        onLogin={onLogin}
        onLogout={onLogout}
      />

      <section className="start__panel">
        <header className="start__brand">
          {onBack === undefined ? null : (
            <button type="button" className="start__back" onClick={onBack}>
              ← Hauptmenü
            </button>
          )}
          <h1>{mode === 'all' ? 'Conquerist' : heading}</h1>
          <p className="start__lead">Drei bis sechs Spieler — an sechs Geräten oder an einem.</p>
        </header>

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
            <p className="start__note">
              Gleicher Seed, gleiches Brett — bei euch und bei allen anderen.
            </p>
          </fieldset>
        ) : null}

        {showsBoard ? (
          <div className="boardfact">
            <span className="boardfact__name">{blueprint?.name ?? 'Kein passendes Brett'}</span>
            <span className="boardfact__detail">
              {blueprint === undefined
                ? `${seats.length} Spieler`
                : `${blueprint.rows.reduce((sum, row) => sum + row, 0)} Felder`}
            </span>
          </div>
        ) : null}

        {shown === null ? null : <p className="error">{shown}</p>}

        {/*
         * Weitermachen steht ueber Neuanfangen: wer schon irgendwo sitzt, will
         * meistens dorthin zurueck. Gibt es keine Partie, faellt der Bereich
         * ganz weg - eine leere Ueberschrift ist eine Auskunft ueber nichts.
         */}
        {myRooms.length === 0 ? null : (
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

                  <button type="button" className="button" onClick={() => onResume?.(entry.code)}>
                    Zurück in die Partie
                  </button>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/*
         * Der Name steht bei beiden Online-Wegen, deshalb einmal davor. Wer
         * erstellt und wer beitritt, braucht ihn gleichermassen - zweimal
         * dasselbe Feld waeren zwei Orte fuer eine Angabe.
         */}
        {showsOnline || showsJoin ? (
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

        {showsOnline ? (
          <section className="way">
            <span className="eyebrow">Online spielen</span>
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

        {showsJoin ? (
          <section className="way">
            <span className="eyebrow">Partie beitreten</span>
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

        {showsLocal ? (
          <section className="way">
            <span className="eyebrow">An einem Gerät</span>
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

        {/*
         * Der Inhalt wird erst erzeugt, wenn das Feld offen ist - und nicht
         * bloss ausgeblendet. `details` versteckt seine Kinder nur optisch; sie
         * waeren gerendert, `useConnection` liefe, und eine Hotseat-Partie
         * haette eine WebSocket-Verbindung, die sie nicht braucht. Ein Test
         * haelt das fest.
         */}
        <details
          className="start__diagnostics"
          open={diagnosticsOpen}
          onToggle={(event) => setDiagnosticsOpen(event.currentTarget.open)}
        >
          <summary>Verbindung und Diagnose (Etappe 0)</summary>
          {diagnosticsOpen ? <ConnectionPanel /> : null}
        </details>
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
