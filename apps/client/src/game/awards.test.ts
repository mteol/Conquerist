import { describe, expect, it } from 'vitest';
import {
  CLASSIC_34,
  CLASSIC_RULES,
  createGame,
  generateScenario,
  legalActions,
  playerViewOf,
  reduce,
  setupPlayer,
  type GameState,
} from '@conquerist/shared';
import { defaultSeats } from '../seats';
import { afterOpening } from '../test/opening';
import { awardFoot, awardTitle, awardsHeldBy, awardsOf, openAwards } from './awards';

const scenario = generateScenario(CLASSIC_34, 'awards-probe');
const seats = defaultSeats(3);
const ids = seats.map((seat) => seat.id);

function afterSetup(): GameState {
  let state = afterOpening(createGame(scenario, CLASSIC_RULES, ids, 'awards-probe'));

  while (state.phase.kind === 'setup') {
    const player = setupPlayer(state)!;
    const result = reduce(state, legalActions(state, player)[0]!);
    if (!result.ok) throw new Error(result.error.message);
    state = result.state;
  }

  return state;
}

/** Die Sicht des ersten Spielers auf einen Zustand, in den wir hineingeschrieben haben. */
function viewOf(state: GameState) {
  return playerViewOf(state, ids[0]!, seats, 1);
}

describe('Auszeichnungen', () => {
  it('liegen zu Beginn beide frei und nennen ihre Bedingung', () => {
    const awards = awardsOf(viewOf(afterSetup()));

    expect(awards.map((award) => award.id)).toEqual(['longestRoad', 'largestArmy']);
    expect(openAwards(awards)).toHaveLength(2);
    expect(awards.map(awardFoot)).toEqual(['ab 5 Straßen', 'ab 3 Ritter']);
  });

  it('nennt Namen und Farbe des Inhabers, statt nur seine Id zu tragen', () => {
    const state = afterSetup();
    const held: GameState = {
      ...state,
      longestRoad: { holder: ids[1]!, length: 6 },
    };

    const [road] = awardsOf(viewOf(held));

    expect(road?.holder).toBe(ids[1]);
    expect(road?.holderName).toBe(seats[1]!.name);
    expect(road?.holderColor).toBe(seats[1]!.color);
    expect(awardFoot(road!)).toBe('6 Straßen');
    expect(awardsHeldBy(awardsOf(viewOf(held)), ids[1]!)).toHaveLength(1);
  });

  /*
   * Der Fall, den ein blosses „liegt noch da" verschwiegen haette: die
   * Handelsstrasse fuehrt ihre Laenge auch dann, wenn sie niemand haelt -
   * `recomputeLongestRoad` laesst sie bei Gleichstand ohne Inhaber liegen. „Ab
   * 5 Straßen" waere dort schlicht falsch.
   */
  it('sagt bei Gleichstand, worauf gleichauf ist - nicht die Mindestlaenge', () => {
    const state = afterSetup();
    const tied: GameState = {
      ...state,
      longestRoad: { holder: null, length: 7 },
    };

    const [road] = awardsOf(viewOf(tied));

    expect(road?.holder).toBeNull();
    expect(awardFoot(road!)).toBe('Gleichauf bei 7');
  });

  it('traegt Schwelle und Punktwert aus dem Regelwerk und nicht aus einer Abschrift', () => {
    const awards = awardsOf(viewOf(afterSetup()));
    const [road, army] = awards;

    expect(road?.minimum).toBe(CLASSIC_RULES.longestRoadMinimum);
    expect(road?.points).toBe(CLASSIC_RULES.victoryPoints.longestRoad);
    expect(army?.minimum).toBe(CLASSIC_RULES.largestArmyMinimum);
    expect(army?.points).toBe(CLASSIC_RULES.victoryPoints.largestArmy);
  });

  it('sagt im vollen Satz, wer sie haelt und wer nicht', () => {
    const state = afterSetup();
    const held: GameState = { ...state, largestArmy: { holder: ids[2]!, size: 4 } };
    const [road, army] = awardsOf(viewOf(held));

    expect(awardTitle(road!)).toContain('hat noch niemand');
    expect(awardTitle(army!)).toContain(`hält ${seats[2]!.name}`);
    expect(awardTitle(army!)).toContain('4 Ritter');
    expect(awardTitle(army!)).toContain('2 Siegpunkte');
  });
});

/**
 * Was null einbringt, wird nicht vergeben.
 *
 * In Staedte & Ritter bleibt die Sondersiegpunkttafel "Groesste Rittermacht" in
 * der Schachtel. Ihre Karte lag trotzdem am Tisch und versprach "ab 3 Ritter" -
 * ein Wettlauf, den niemand laufen kann, um einen Preis, der null zaehlt. Im
 * Browser aufgefallen, nicht gerechnet.
 */
describe('Auszeichnungen, die es an diesem Tisch nicht gibt', () => {
  it('laesst die Rittermacht weg, wenn sie null Punkte bringt', () => {
    const state = afterSetup();
    const ohne: GameState = {
      ...state,
      rules: {
        ...state.rules,
        victoryPoints: { ...state.rules.victoryPoints, largestArmy: 0 },
      },
    };

    expect(awardsOf(viewOf(ohne)).map((award) => award.id)).toEqual(['longestRoad']);
  });

  it('zeigt im Basisspiel weiterhin beide', () => {
    expect(awardsOf(viewOf(afterSetup())).map((award) => award.id)).toEqual([
      'longestRoad',
      'largestArmy',
    ]);
  });
});
