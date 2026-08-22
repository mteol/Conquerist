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
import { NUMERAL_CAP, numeralWidth } from '../type/Numerals';
import { afterOpening } from '../test/opening';

const scenario = generateScenario(CLASSIC_34, 'board-probe');
const seats = defaultSeats(3);
const start = afterOpening(
  createGame(
    scenario,
    CLASSIC_RULES,
    seats.map((seat) => seat.id),
    'board-probe',
  ),
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
      const number = screen.getByTestId(`chip-${placement.hex}`).querySelector('.chip__numeral');
      expect(number?.classList.contains('chip__numeral--hot')).toBe(hot.has(placement));
    }
  });

  /*
   * **Was die Zahl sagt, sagte bisher niemand nach.**
   *
   * Geprueft wurde hier nur die Markierung „heiss" - dass auf dem Chip
   * ueberhaupt die richtige Zahl steht, stand nirgends. Solange sie ein `text`
   * war, fiel das kaum auf; jetzt ist sie eine Folge gezeichneter Formen, und
   * eine falsch nachgeschlagene Ziffer waere eine stille Verwechslung. Genau
   * dafuer traegt jeder Pfad, welche Ziffer er ist.
   */
  it('zeichnet auf jedem Chip die Zahl, die dort hingehoert', () => {
    render(<BoardSvg state={start} targets={EMPTY_TARGETS} seats={seats} onPick={vi.fn()} />);

    let counted = 0;

    for (const placement of scenario.hexes) {
      if (placement.chip === undefined) continue;

      const drawn = [
        ...screen
          .getByTestId(`chip-${placement.hex}`)
          .querySelectorAll('.chip__numeral [data-digit]'),
      ];

      expect(drawn.map((path) => path.getAttribute('data-digit')).join('')).toBe(
        String(placement.chip),
      );
      counted += 1;
    }

    expect(counted).toBeGreaterThan(0);
  });

  /*
   * **Die Zahl bleibt auf dem Chip - gerechnet, nicht geschaetzt.**
   *
   * Dieselbe Pruefung, die die Augen darunter schon haben, und aus demselben
   * Grund: eine Zahl, die ueber den Chiprand ragt, sieht nach Fehler aus, und
   * ob sie es tut, haengt an Versalhoehe, Ziffernzahl und Versatz zugleich.
   * Als `text` war das nicht nachrechenbar - die Breite haette an den Metriken
   * einer Schrift gehangen, die auf dem Rechner des Spielers fehlen kann.
   * Gezeichnet ist sie es: die Zahl steht in ihrer eigenen Streckung im Blatt.
   *
   * Die zweistellige Zwoelf ist dabei der Ernstfall, die heisse Sechs mit
   * ihrer groesseren Versalhoehe der zweite - beide kommen im Aufbau vor.
   */
  it('haelt die Zahl innerhalb des Chips - gerechnet, nicht geschaetzt', () => {
    render(<BoardSvg state={start} targets={EMPTY_TARGETS} seats={seats} onPick={vi.fn()} />);

    /** Der Radius, mit dem `BoardSvg` die Chipscheibe zeichnet. */
    const CHIP = 0.34;
    let widest = 0;

    for (const placement of scenario.hexes) {
      if (placement.chip === undefined) continue;

      const group = screen.getByTestId(`chip-${placement.hex}`);
      const disc = group.querySelector(':scope > circle')!;
      const cx = Number(disc.getAttribute('cx'));
      const cy = Number(disc.getAttribute('cy'));

      const numeral = group.querySelector('.chip__numeral')!;
      const [, x, y, scale] = /translate\(([-\d.]+) ([-\d.]+)\) scale\(([\d.]+)\)/
        .exec(numeral.getAttribute('transform')!)!
        .map(Number) as unknown as [unknown, number, number, number];

      const width = numeralWidth(placement.chip) * scale;
      const height = NUMERAL_CAP * scale;

      // Die weiteste der vier Ecken entscheidet, nicht die Mitte einer Kante.
      for (const corner of [
        [x, y],
        [x + width, y],
        [x, y + height],
        [x + width, y + height],
      ]) {
        const reach = Math.hypot(corner[0]! - cx, corner[1]! - cy);

        expect(reach).toBeLessThan(CHIP);
        widest = Math.max(widest, reach);
      }
    }

    // Ohne diese Zeile bestuende der Test auch, wenn gar keine Zahl mehr da waere.
    expect(widest).toBeGreaterThan(0);
  });

  /*
   * Die Stadt war bis zum ersten Playtest ein groesserer Punkt. Groesse liest
   * man nur im Vergleich, und zwei eigene Bauwerke stehen selten nebeneinander;
   * die Form dagegen liest man einzeln.
   */
  /*
   * **Die Augen ragten ueber den Chiprand hinaus, und das ist hier rechenbar.**
   *
   * Sie waren ein `text` aus Mittelpunkten, dessen `font-size` in `.chip__pips`
   * stand - unter `.chip text`, das eine Klasse plus einen Typ hat und deshalb
   * gewinnt. Statt 0.19px wurden 0.32px gesetzt, und fuenf Punkte in dieser
   * Groesse sind breiter als der Chip. Als Kreise haben sie keine Metrik mehr,
   * die eine Schrift verschieben koennte - und ihre Lage laesst sich ohne
   * Layout-Engine nachrechnen, also wird sie das hier.
   */
  it('haelt die Augen innerhalb des Chips - gerechnet, nicht geschaetzt', () => {
    render(<BoardSvg state={start} targets={EMPTY_TARGETS} seats={seats} onPick={vi.fn()} />);

    /** Der Radius, mit dem `BoardSvg` die Chipscheibe zeichnet. */
    const CHIP = 0.34;
    let counted = 0;

    for (const placement of scenario.hexes) {
      if (placement.chip === undefined) continue;

      const group = screen.getByTestId(`chip-${placement.hex}`);
      const disc = group.querySelector(':scope > circle')!;
      const cx = Number(disc.getAttribute('cx'));
      const cy = Number(disc.getAttribute('cy'));

      const pips = [...group.querySelectorAll('.chip__pips circle')];
      expect(pips.length).toBeGreaterThan(0);

      for (const pip of pips) {
        const reach =
          Math.hypot(Number(pip.getAttribute('cx')) - cx, Number(pip.getAttribute('cy')) - cy) +
          Number(pip.getAttribute('r'));

        expect(reach).toBeLessThan(CHIP);
        counted += 1;
      }
    }

    // Ein Test, der nichts gezaehlt hat, hat nichts geprueft.
    expect(counted).toBeGreaterThan(0);
  });

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
