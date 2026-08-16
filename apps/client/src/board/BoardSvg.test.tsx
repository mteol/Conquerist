// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
  CLASSIC_34,
  CLASSIC_RULES,
  boardOf,
  createGame,
  generateScenario,
  setupPlayer,
} from '@conquerist/shared';
import { render, screen, userEvent } from '../test/dom';
import { defaultSeats } from '../seats';
import { EMPTY_TARGETS, actionTargets } from '../game/targets';
import { BoardSvg } from './BoardSvg';

const scenario = generateScenario(CLASSIC_34, 'board-probe');
const seats = defaultSeats(3);
const start = createGame(
  scenario,
  CLASSIC_RULES,
  seats.map((seat) => seat.id),
  'board-probe',
);

describe('BoardSvg', () => {
  it('zeichnet jedes Feld des Szenarios', () => {
    render(
      <BoardSvg
        state={start}
        targets={actionTargets(start, 'p1')}
        seats={seats}
        onPick={vi.fn()}
      />,
    );

    for (const placement of scenario.hexes) {
      expect(screen.getByTestId(`hex-${placement.hex}`)).toBeDefined();
    }
  });

  /*
   * Die Farbe selbst steht im Blatt und ist von hier aus nicht messbar - jsdom
   * rechnet keine Kaskade aus. Geprueft wird deshalb die Markierung, an der die
   * Regel haengt: genau die Sechsen und Achten tragen sie, und keine andere.
   * Genau das war beim ersten Playtest falsch, wenn auch eine Ebene tiefer.
   */
  it('markiert die Sechs und die Acht als heiss - und sonst keine Zahl', () => {
    render(
      <BoardSvg
        state={start}
        targets={actionTargets(start, 'p1')}
        seats={seats}
        onPick={vi.fn()}
      />,
    );

    const hot = new Set(
      scenario.hexes.filter((placement) => placement.chip === 6 || placement.chip === 8),
    );
    expect(hot.size).toBeGreaterThan(0);

    for (const placement of scenario.hexes) {
      if (placement.chip === undefined) continue;
      const number = screen
        .getByTestId(`hex-${placement.hex}`)
        .parentElement!.querySelector('text');
      expect(number?.dataset['hot']).toBe(hot.has(placement) ? 'true' : 'false');
    }
  });

  /*
   * Die Stadt war bis zum ersten Playtest ein groesserer Punkt. Groesse liest
   * man nur im Vergleich, und zwei eigene Bauwerke stehen selten nebeneinander;
   * die Form dagegen liest man einzeln.
   */
  it('zeichnet Siedlung und Stadt als verschiedene Formen, nicht als zwei Punkte', () => {
    const vertices = boardOf(scenario).topology.vertices;
    const withBoth = {
      ...start,
      buildings: {
        [vertices[0]!]: { owner: seats[0]!.id, kind: 'settlement' as const },
        [vertices[8]!]: { owner: seats[0]!.id, kind: 'city' as const },
      },
    };

    render(<BoardSvg state={withBoth} targets={EMPTY_TARGETS} seats={seats} onPick={vi.fn()} />);

    const settlement = screen
      .getByTestId(`vertex-${vertices[0]}`)
      .querySelector('.vertex__building');
    const city = screen.getByTestId(`vertex-${vertices[8]}`).querySelector('.vertex__building');

    expect(settlement?.tagName.toLowerCase()).toBe('path');
    expect(city?.tagName.toLowerCase()).toBe('path');
    expect(city?.getAttribute('d')).not.toBe(settlement?.getAttribute('d'));
    expect(city?.getAttribute('class')).toContain('building--city');
  });

  it('hebt genau die Knoten hervor, die in der Klickkarte stehen', () => {
    const targets = actionTargets(start, setupPlayer(start)!);
    render(<BoardSvg state={start} targets={targets} seats={seats} onPick={vi.fn()} />);

    const marked = screen
      .getAllByTestId(/^vertex-/)
      .filter((element) => element.dataset['target'] === 'true');

    expect(marked).toHaveLength(targets.vertices.size);
  });

  it('meldet den angeklickten Knoten', async () => {
    const targets = actionTargets(start, setupPlayer(start)!);
    const vertex = [...targets.vertices.keys()][0]!;
    const onPick = vi.fn();

    render(<BoardSvg state={start} targets={targets} seats={seats} onPick={onPick} />);
    await userEvent.click(screen.getByTestId(`vertex-${vertex}`));

    expect(onPick).toHaveBeenCalledWith({ kind: 'vertex', id: vertex });
  });

  it('meldet nichts, wenn der Knoten nicht in der Klickkarte steht', async () => {
    const targets = actionTargets(start, 'p3');
    const onPick = vi.fn();

    render(<BoardSvg state={start} targets={targets} seats={seats} onPick={onPick} />);
    const anyVertex = screen.getAllByTestId(/^vertex-/)[0]!;
    await userEvent.click(anyVertex);

    expect(onPick).not.toHaveBeenCalled();
  });
});
