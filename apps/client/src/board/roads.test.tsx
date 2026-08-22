// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
  CLASSIC_34,
  CLASSIC_RULES,
  createGame,
  generateScenario,
  legalActions,
  reduce,
  setupPlayer,
  type GameState,
} from '@conquerist/shared';
import { render, screen } from '../test/dom';
import { defaultSeats } from '../seats';
import { EMPTY_TARGETS } from '../game/targets';
import { BoardSvg } from './BoardSvg';
import { afterOpening } from '../test/opening';

/**
 * Regression: gebaute Strassen waren unsichtbar.
 *
 * Der Grund ist eine Falle, die man einmal erlebt haben muss: `.road` setzt in
 * der Stylesheet `stroke: transparent`, damit die freien Kanten unsichtbare
 * Trefferflaechen sind. Eine CSS-Regel schlaegt aber immer das gleichnamige
 * Praesentationsattribut im SVG - `stroke={farbe}` am Element hatte deshalb
 * keine Wirkung, und jede gebaute Strasse blieb durchsichtig.
 *
 * Deshalb prueft dieser Test nicht „hat ein stroke-Attribut", sondern die
 * Eigenschaft, auf die es ankommt: die Farbe steht am Element so, dass die
 * Stylesheet sie nicht uebersteuern kann.
 */

const scenario = generateScenario(CLASSIC_34, 'road-probe');
const seats = defaultSeats(3);

/** Setzt die erste Gruendungssiedlung samt zugehoeriger Strasse. */
function withOneRoad(): {
  readonly state: GameState;
  readonly edge: string;
  readonly builder: string;
} {
  let state = afterOpening(
    createGame(
      scenario,
      CLASSIC_RULES,
      seats.map((seat) => seat.id),
      'road-probe',
    ),
  );

  const settlement = legalActions(state, setupPlayer(state)!)[0]!;
  const placed = reduce(state, settlement);
  if (!placed.ok) throw new Error(placed.error.message);
  state = placed.state;

  const road = legalActions(state, setupPlayer(state)!)[0]!;
  if (road.type !== 'placeSetupRoad')
    throw new Error(`Erwartet war eine Strasse, war ${road.type}`);

  const built = reduce(state, road);
  if (!built.ok) throw new Error(built.error.message);

  return { state: built.state, edge: road.edge, builder: road.player };
}

/**
 * Was der Browser aus einer Farbangabe macht.
 *
 * Die Sitzfarbe steht als `#2c6fbb` im Blatt, `style.stroke` liefert
 * `rgb(44, 111, 187)`. Statt die zweite Schreibweise abzuschreiben - und damit
 * eine zweite Wahrheit ueber dieselbe Farbe zu fuehren - laeuft der Vergleich
 * durch dieselbe Normalisierung.
 */
function alsRgb(farbe: string): string {
  const probe = document.createElement('span');
  probe.style.color = farbe;
  return probe.style.color.replace(/\s/g, '');
}

describe('Gebaute Strassen', () => {
  it('tragen die Spielerfarbe uebersteuerungssicher am Element', () => {
    const { state, edge, builder } = withOneRoad();

    render(<BoardSvg state={state} targets={EMPTY_TARGETS} seats={seats} onPick={vi.fn()} />);

    const line = screen.getByTestId(`edge-${edge}`);

    // Wer zuerst setzt, entscheidet der Auftakt - die erwartete Farbe kommt
    // deshalb vom Sitz des tatsaechlichen Erbauers und steht nicht fest.
    const farbe = seats.find((seat) => seat.id === builder)!.color;

    // `style` gewinnt gegen jede Stylesheet-Regel; ein blosses Attribut nicht.
    expect(line.style.stroke).not.toBe('');
    expect(line.style.stroke.replace(/\s/g, '')).toBe(alsRgb(farbe));
  });

  it('laesst freie Kanten ohne eigene Farbe', () => {
    const { state } = withOneRoad();

    render(<BoardSvg state={state} targets={EMPTY_TARGETS} seats={seats} onPick={vi.fn()} />);

    const free = screen.getAllByTestId(/^edge-/).filter((element) => element.style.stroke === '');

    // Auf dem Basisbrett gibt es 72 Kanten; genau eine ist bebaut.
    expect(free).toHaveLength(71);
  });

  /*
   * Die Kontur ist die Antwort auf „am Brettrand sind die Strassen unsichtbar"
   * aus dem ersten Playtest. Am Element lag es nicht - gemessen: die
   * Kuestenkanten liegen in der viewBox, tragen ihre Klasse und ihre Farbe. Es
   * lag am Untergrund: eine Strasse an der Kueste liegt zur Haelfte auf der
   * dunklen See, und ein dunkler Streifen darauf verschwindet.
   *
   * Geprueft wird die Zeichenreihenfolge: die Kontur muss **vor** der Strasse
   * kommen, sonst deckt sie sie zu.
   */
  it('bekommen eine Kontur, und zwar unter sich', () => {
    const { state, edge } = withOneRoad();

    render(<BoardSvg state={state} targets={EMPTY_TARGETS} seats={seats} onPick={vi.fn()} />);

    const line = screen.getByTestId(`edge-${edge}`);
    const casing = document.querySelector('.road__casing')!;

    expect(casing).not.toBeNull();
    // In SVG entscheidet die Dokumentreihenfolge, was oben liegt: die Kontur
    // muss davor stehen, sonst deckt sie die Strasse zu.
    expect(casing.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Und sie liegt genau auf der Strasse, nicht daneben.
    expect(casing.getAttribute('x1')).toBe(line.getAttribute('x1'));
    expect(casing.getAttribute('y2')).toBe(line.getAttribute('y2'));
  });

  it('gibt freien Kanten keine Kontur - sonst waere jede Kante ein Strich', () => {
    const { state } = withOneRoad();

    render(<BoardSvg state={state} targets={EMPTY_TARGETS} seats={seats} onPick={vi.fn()} />);

    expect(document.querySelectorAll('.road__casing')).toHaveLength(1);
  });
});
