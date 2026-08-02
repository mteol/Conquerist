import type { JSX } from 'react';
import type { GameView } from '../game/view';

/**
 * Runde, letzter Wurf, was gerade dran ist.
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
export function StatusPanel({ view }: { readonly view: GameView }): JSX.Element {
  const waiting = view.waitingFor;
  const away = view.disconnected.filter((player) => !waiting.includes(player));

  return (
    <section className="panel panel--status">
      <div className="status__phase">{view.phaseText}</div>
      <div className="status__turn">Runde {view.turn}</div>

      {view.lastRoll === null ? null : (
        <div className="status__dice" data-testid="last-roll">
          <span className="die">{view.lastRoll[0]}</span>
          <span className="die">{view.lastRoll[1]}</span>
          <span className="status__sum">{view.lastRoll[0] + view.lastRoll[1]}</span>
        </div>
      )}

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

/** „Anna", „Anna und Ben", „Anna, Ben und Cem". */
function nameList(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} und ${names[names.length - 1]}`;
}
