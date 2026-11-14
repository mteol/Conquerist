import type { CSSProperties, JSX, ReactNode } from 'react';
import type { GameView, PlayerRow } from '../game/view';

/**
 * Runde und was gerade dran ist.
 *
 * Der letzte Wurf stand hier einmal und steht jetzt in der Ablage, weil er dort
 * zugleich der Zug ist, mit dem man wuerfelt (`DiceTray`). Zweimal dieselben
 * Augen an zwei Ecken des Bildschirms waeren eine Verdopplung, und die eine
 * Stelle, an der man wirft, ist die richtige.
 *
 * Dazu die Trennungen, und zwar in zwei Staerken. Wer weg ist, steht klein
 * darunter - man soll es wissen, aber nicht daran haengenbleiben. Wartet die
 * Partie dagegen auf jemanden, der nicht da ist, wird daraus der Grund, warum
 * gerade nichts passiert; ohne diesen Satz sucht man den Fehler bei sich.
 *
 * Die Partie bleibt dabei von selbst stehen: Zuege gibt es nur fuer den, der
 * handeln darf, und der kann sie ohne Verbindung nicht schicken. Hier wird
 * also nichts angehalten - hier wird gesagt, dass es steht.
 */
export function StatusPanel({
  view,
  children,
}: {
  readonly view: GameView;
  readonly children?: ReactNode;
}): JSX.Element {
  const waiting = view.waitingFor;
  const away = view.disconnected.filter((player) => !waiting.includes(player));

  /*
   * Die Kartusche: wer dran ist, ist die größte Schrift der Ecke. Handeln
   * mehrere (Abwurf nach der Sieben), stehen alle da - eine Farbe allein trüge
   * nicht (Designregel 7), der Name steht immer dabei.
   */
  const actors = view.actingPlayers
    .map((id) => view.players.find((player) => player.id === id))
    .filter((player): player is PlayerRow => player !== undefined);
  const who = nameList(actors.map((player) => player.name));
  const ask = askOf(view.phaseText, who);

  return (
    <section className="panel panel--status">
      {actors.length > 0 ? (
        <div className="status__who">
          {/* Die Wimpel bleiben stehen und wechseln nur die Farbe (`transition`), die Namen kommen neu. */}
          {actors.slice(0, 4).map((player, index) => (
            <Pennant key={index} color={player.color} />
          ))}
          <span key={who} className="status__name ink-in">
            {who}
          </span>
        </div>
      ) : null}
      <div key={view.phaseText} className="status__phase chartlabel ink-in">
        {actors.length > 0 ? ask : view.phaseText}
      </div>
      {view.adaptedTurn ? (
        <p className="status__note" data-testid="adapted-turn">
          Kein Wurf, Handel nur mit der Bank
        </p>
      ) : null}
      <div className="status__turn chartlabel">Runde {view.turn}</div>
      {children}

      {waiting.length > 0 ? (
        <p className="status__waiting" role="status" data-testid="waiting-for">
          Wartet auf {nameList(waiting.map((player) => player.name))} — getrennt. Es geht weiter,
          sobald {waiting.length === 1 ? 'die Verbindung' : 'die Verbindungen'} wieder steht.
        </p>
      ) : null}

      {away.length > 0 ? (
        <p className="status__away" data-testid="away">
          {nameList(away.map((player) => player.name))} {away.length === 1 ? 'ist' : 'sind'} gerade
          getrennt.
        </p>
      ) : null}
    </section>
  );
}

/**
 * Was verlangt ist, ohne den Namen: die Zeile darüber hat ihn schon, und
 * „Spieler 3" / „versetzt den Räuber" liest sich als ein Satz über zwei Zeilen.
 * Beginnt der Satz anders („Gründung: …", „Sieben: …"), steht er ganz da.
 */
function askOf(phaseText: string, who: string): string {
  return phaseText.startsWith(`${who} `) ? phaseText.slice(who.length + 1) : phaseText;
}

/** Der Wimpel in Sitzfarbe - ein Schwalbenschwanz, damit er eine Form hat und nicht nur Farbe. */
function Pennant({ color }: { readonly color: string }): JSX.Element {
  return (
    <svg
      className="status__pennant"
      viewBox="0 0 20 14"
      style={{ '--seat': color } as CSSProperties}
      aria-hidden="true"
    >
      <path d="M1 1 H19 L14 7 L19 13 H1 Z" />
    </svg>
  );
}

/** „Anna", „Anna und Ben", „Anna, Ben und Cem". */
function nameList(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} und ${names[names.length - 1]}`;
}
