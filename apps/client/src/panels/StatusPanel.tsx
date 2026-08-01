import type { JSX } from 'react';
import type { GameView } from '../game/view';

/** Runde, letzter Wurf, was gerade dran ist. */
export function StatusPanel({ view }: { readonly view: GameView }): JSX.Element {
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
    </section>
  );
}
