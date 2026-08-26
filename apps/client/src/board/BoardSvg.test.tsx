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
import { fireEvent, render, screen, userEvent } from '../test/dom';
import { defaultSeats } from '../seats';
import { EMPTY_TARGETS, actionTargets } from '../game/targets';
import { BoardSvg } from './BoardSvg';
import { vertexPoint } from './layout';
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

/**
 * Tippt auf die Fangflaeche, an einem Punkt in viewBox-Koordinaten.
 *
 * Zwei Kunstgriffe, beide unvermeidlich: jsdom kennt `getScreenCTM` nicht, also
 * steht dort eine Einheitsmatrix - damit sind Klick- und viewBox-Koordinaten
 * dasselbe. Und geklickt wird ueber `fireEvent` statt `userEvent`, weil
 * letzteres die Koordinaten aus dem Zielrechteck nimmt und dabei rundet; auf
 * einem Brett, das keine zehn Einheiten breit ist, waere danach jede Genauigkeit
 * weg.
 */
function tapBoard(container: HTMLElement, x: number, y: number): void {
  const svg = container.querySelector('svg')!;
  svg.getScreenCTM = () =>
    ({ inverse: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) }) as unknown as DOMMatrix;

  fireEvent.click(container.querySelector('[data-testid="board-catcher"]')!, {
    clientX: x,
    clientY: y,
  });
}

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
        [vertices[0]!]: {
          owner: seats[0]!.id,
          kind: 'settlement' as const,
          wall: false,
          metropolis: null,
        },
        [vertices[8]!]: {
          owner: seats[0]!.id,
          kind: 'city' as const,
          wall: false,
          metropolis: null,
        },
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

  /*
   * **Der Geist war ein halbes Brett gross.**
   *
   * Er stand mit `scale(0.42)` da, das gebaute Haus mit 0.027 - beide zeichnen
   * denselben Pfad aus `board/shapes.ts`, der rund 12 Einheiten misst, wo ein
   * Feld eine misst. Im Browser gemessen: 355 x 414 px Vorschau auf einem Brett
   * von 688 x 647 px, also mehr als die halbe Flaeche, und darunter war nichts
   * mehr zu erkennen - genau die Stelle, an der man gerade gezielt hat.
   *
   * Geprueft wird deshalb nicht eine Zahl gegen sich selbst, sondern der Geist
   * gegen das Bauwerk, das er meint: dieselbe Form an derselben Stelle in
   * derselben Groesse. Beide Bauteile, weil sie verschiedene Faktoren tragen.
   */
  it('zeichnet den Geist in der Groesse des Bauwerks, das er meint', () => {
    const vertices = boardOf(scenario).topology.vertices;

    /** Der `scale`-Faktor aus einem `transform`, wie ihn das Brett schreibt. */
    const scaleOf = (element: Element | null): number =>
      Number(/scale\(([\d.]+)\)/.exec(element!.getAttribute('transform')!)![1]);

    for (const kind of ['settlement', 'city'] as const) {
      // Ein gebautes Bauwerk und daneben ein Geist auf dieselbe Art: die Stadt
      // braucht eine eigene Siedlung unter sich, damit `buildCity` erlaubt ist.
      const built = {
        ...start.buildings,
        [vertices[0]!]: { owner: 'p1' as const, kind, wall: false, metropolis: null },
      };
      const ghost = vertices[8]!;
      const targets = {
        ...EMPTY_TARGETS,
        vertices: new Map([
          [
            ghost,
            (kind === 'city'
              ? { type: 'buildCity', player: 'p1', vertex: ghost }
              : { type: 'buildSettlement', player: 'p1', vertex: ghost }) as never,
          ],
        ]),
      };

      const { container, unmount } = render(
        <BoardSvg
          state={{ ...start, buildings: built }}
          targets={targets}
          seats={seats}
          onPick={vi.fn()}
          pending={{ kind: 'vertex', id: ghost }}
        />,
      );

      const real = scaleOf(
        container.querySelector(`[data-testid="vertex-${vertices[0]}"] .vertex__building`)!
          .parentElement,
      );
      const pending = scaleOf(container.querySelector(`[data-testid="pending-${ghost}"] path`));

      expect(pending).toBe(real);
      // Und die Probe aufs Ganze: ein Bauwerk ist kleiner als ein Feld.
      expect(pending * 12).toBeLessThan(1);

      unmount();
    }
  });

  it('hebt genau die Knoten hervor, die in der Klickkarte stehen', () => {
    const targets = actionTargets(start, setupPlayer(start)!);
    render(<BoardSvg state={start} targets={targets} seats={seats} onPick={vi.fn()} />);

    const marked = screen
      .getAllByTestId(/^vertex-/)
      .filter((element) => element.dataset['target'] === 'true');

    expect(marked).toHaveLength(targets.vertices.size);
  });

  it('meldet den Knoten, der dem Tipp am naechsten liegt', async () => {
    const targets = actionTargets(start, setupPlayer(start)!);
    const vertex = [...targets.vertices.keys()][0]!;
    const punkt = vertexPoint(vertex);
    const onPick = vi.fn();

    const { container } = render(
      <BoardSvg state={start} targets={targets} seats={seats} onPick={onPick} />,
    );

    // Getippt wird knapp neben den Knoten - genau der Fall, den die
    // Fangflaeche loesen soll.
    tapBoard(container, punkt.x + 0.15, punkt.y);

    expect(onPick).toHaveBeenCalledWith({ kind: 'vertex', id: vertex });
  });

  it('meldet nichts, wenn der Tipp weit neben jedem Ziel liegt', async () => {
    const targets = actionTargets(start, setupPlayer(start)!);
    const onPick = vi.fn();

    const { container } = render(
      <BoardSvg state={start} targets={targets} seats={seats} onPick={onPick} />,
    );
    tapBoard(container, 999, 999);

    expect(onPick).not.toHaveBeenCalled();
  });

  it('meldet nichts, wenn es gar keine Ziele gibt', async () => {
    // Das Vorschau-Brett auf dem Startbildschirm: es faengt, aber trifft nie.
    const onPick = vi.fn();

    const { container } = render(
      <BoardSvg state={start} targets={EMPTY_TARGETS} seats={seats} onPick={onPick} />,
    );
    tapBoard(container, 0, 0);

    expect(onPick).not.toHaveBeenCalled();
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

/**
 * Ritter und Mauern auf dem Brett.
 *
 * Drei Dinge muß eine Ritterfigur auf einen Blick sagen: wem sie gehört, wie
 * stark sie ist und ob sie handeln kann. Die Farbe steht per `style` da (eine
 * gleichnamige CSS-Regel schlüge jedes Präsentationsattribut), die Stärke in
 * der Zahl der Fahnenspitzen, und der Helm sagt „aktiviert".
 */
describe('BoardSvg mit Rittern', () => {
  const vertices = boardOf(scenario).topology.vertices;

  function knight(owner: string, level: 1 | 2 | 3, active: boolean) {
    return { owner, level, active, activatedOnTurn: active ? 1 : null, upgradedThisTurn: false };
  }

  function withKnights(knights: Record<string, ReturnType<typeof knight>>) {
    return { ...start, knights };
  }

  it('zeichnet einen Ritter an seiner Kreuzung, in der Sitzfarbe per style', () => {
    const mine = vertices[3]!;
    const theirs = vertices[9]!;

    render(
      <BoardSvg
        state={withKnights({
          [mine]: knight(seats[0]!.id, 1, false),
          [theirs]: knight(seats[1]!.id, 1, false),
        })}
        targets={EMPTY_TARGETS}
        seats={seats}
        onPick={vi.fn()}
      />,
    );

    const bodyOf = (vertex: string): SVGElement =>
      screen.getByTestId(`knight-${vertex}`).querySelector('.knight__body')!;

    /*
     * Geprueft wird beides: dass die Farbe per `style` kommt (ein Attribut
     * `fill` wuerde von jeder gleichnamigen CSS-Regel geschlagen), und dass
     * sie dem Besitzer folgt. Auf den Hexwert selbst laesst sich nicht
     * pruefen - jsdom normalisiert ihn zu `rgb(...)`.
     */
    expect(bodyOf(mine).getAttribute('fill')).toBeNull();
    expect(bodyOf(mine).getAttribute('style')).toMatch(/fill:/);
    expect(bodyOf(mine).getAttribute('style')).not.toBe(bodyOf(theirs).getAttribute('style'));
  });

  it('traegt Stufe und Helmzustand als Daten', () => {
    const vertex = vertices[3]!;
    render(
      <BoardSvg
        state={withKnights({ [vertex]: knight(seats[1]!.id, 2, true) })}
        targets={EMPTY_TARGETS}
        seats={seats}
        onPick={vi.fn()}
      />,
    );

    const figure = screen.getByTestId(`knight-${vertex}`);
    expect(figure.getAttribute('data-level')).toBe('2');
    expect(figure.getAttribute('data-active')).toBe('true');
  });

  it('zeigt so viele Fahnenspitzen, wie der Ritter Stufen hat', () => {
    for (const level of [1, 2, 3] as const) {
      const vertex = vertices[3]!;
      const view = render(
        <BoardSvg
          state={withKnights({ [vertex]: knight(seats[0]!.id, level, false) })}
          targets={EMPTY_TARGETS}
          seats={seats}
          onPick={vi.fn()}
        />,
      );

      const figure = screen.getByTestId(`knight-${vertex}`);
      expect(figure.querySelectorAll('.knight__pennant')).toHaveLength(level);

      view.unmount();
    }
  });

  it('setzt den Helm nur einem aktivierten Ritter auf', () => {
    const passive = vertices[3]!;
    const active = vertices[9]!;

    render(
      <BoardSvg
        state={withKnights({
          [passive]: knight(seats[0]!.id, 1, false),
          [active]: knight(seats[0]!.id, 1, true),
        })}
        targets={EMPTY_TARGETS}
        seats={seats}
        onPick={vi.fn()}
      />,
    );

    expect(screen.getByTestId(`knight-${passive}`).querySelector('.knight__helmet')).toBeNull();
    expect(screen.getByTestId(`knight-${active}`).querySelector('.knight__helmet')).not.toBeNull();
  });

  it('zeichnet die Mauer nur an einer Stadt, die eine hat', () => {
    const walled = vertices[0]!;
    const bare = vertices[8]!;

    render(
      <BoardSvg
        state={{
          ...start,
          buildings: {
            [walled]: { owner: seats[0]!.id, kind: 'city' as const, wall: true, metropolis: null },
            [bare]: { owner: seats[0]!.id, kind: 'city' as const, wall: false, metropolis: null },
          },
        }}
        targets={EMPTY_TARGETS}
        seats={seats}
        onPick={vi.fn()}
      />,
    );

    expect(screen.queryByTestId(`wall-${walled}`)).not.toBeNull();
    expect(screen.queryByTestId(`wall-${bare}`)).toBeNull();
  });
});

/**
 * Metropolen auf dem Brett.
 *
 * Der Aufsatz sagt zwei Dinge auf einen Blick - daß diese Stadt eine Metropole
 * ist, und welcher Bereich sie hervorgebracht hat. Die Farbe steht per `style`
 * da (dieselbe Falle wie bei Straße und Ritter), der Bereich zusätzlich als
 * `data-track`, und die drei Bereiche zeichnen verschiedene Formen - Farbe
 * allein wäre kein Träger.
 */
describe('BoardSvg mit Metropolen', () => {
  const vertices = boardOf(scenario).topology.vertices;

  function cityWith(metropolis: 'trade' | 'politics' | 'science' | null, wall = false) {
    return {
      owner: seats[0]!.id,
      kind: 'city' as const,
      wall,
      metropolis,
    };
  }

  it('zeigt den Aufsatz an einer Stadt mit Metropole', () => {
    const vertex = vertices[0]!;
    render(
      <BoardSvg
        state={{ ...start, buildings: { [vertex]: cityWith('trade') } }}
        targets={EMPTY_TARGETS}
        seats={seats}
        onPick={vi.fn()}
      />,
    );

    expect(screen.queryByTestId(`metropolis-${vertex}`)).not.toBeNull();
  });

  it('zeigt keinen Aufsatz an einer Stadt ohne Metropole', () => {
    const vertex = vertices[0]!;
    render(
      <BoardSvg
        state={{ ...start, buildings: { [vertex]: cityWith(null) } }}
        targets={EMPTY_TARGETS}
        seats={seats}
        onPick={vi.fn()}
      />,
    );

    expect(screen.queryByTestId(`metropolis-${vertex}`)).toBeNull();
  });

  it('faerbt den Aufsatz in der Bereichsfarbe per style und traegt den Bereich als data-track', () => {
    const vertex = vertices[0]!;
    render(
      <BoardSvg
        state={{ ...start, buildings: { [vertex]: cityWith('science') } }}
        targets={EMPTY_TARGETS}
        seats={seats}
        onPick={vi.fn()}
      />,
    );

    const topper = screen.getByTestId(`metropolis-${vertex}`);
    expect(topper.style.fill).toBe('var(--track-science)');
    expect(topper.getAttribute('data-track')).toBe('science');
  });

  it('zeichnet fuer die drei Bereiche verschiedene Formen', () => {
    const vertex = vertices[0]!;
    const paths = (['trade', 'politics', 'science'] as const).map((track) => {
      const { unmount } = render(
        <BoardSvg
          state={{ ...start, buildings: { [vertex]: cityWith(track) } }}
          targets={EMPTY_TARGETS}
          seats={seats}
          onPick={vi.fn()}
        />,
      );
      const d = screen.getByTestId(`metropolis-${vertex}`).getAttribute('d');
      unmount();
      return d;
    });

    expect(new Set(paths).size).toBe(3);
  });

  it('zeigt Mauer und Aufsatz gemeinsam an einer ummauerten Metropole', () => {
    const vertex = vertices[0]!;
    render(
      <BoardSvg
        state={{ ...start, buildings: { [vertex]: cityWith('politics', true) } }}
        targets={EMPTY_TARGETS}
        seats={seats}
        onPick={vi.fn()}
      />,
    );

    expect(screen.queryByTestId(`wall-${vertex}`)).not.toBeNull();
    expect(screen.queryByTestId(`metropolis-${vertex}`)).not.toBeNull();
  });
});
