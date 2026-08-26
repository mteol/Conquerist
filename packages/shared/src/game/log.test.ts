import { describe, expect, it } from 'vitest';
import { CLASSIC_34 } from '../scenario/blueprints/classic34.js';
import { generateScenario } from '../scenario/generator.js';
import { CLASSIC_RULES } from '../rules/ruleset.js';
import { seatColorAt, type Seat } from '../seats.js';
import { createGame, setupBuildingKind, setupPlayer } from './setup.js';
import { legalActions } from './legal.js';
import { reduce } from './reducer.js';
import { describeTransition } from './log.js';
import { yieldTotal } from './dice.js';
import { afterOpening, CENTER_VERTEX, gameWithCities, giving, hand, testGame } from './fixtures.js';
import { CITIES_RULES } from '../rules/cities.js';
import { createRng } from '../random/index.js';
import type { GameAction } from './actions.js';
import type { GameState } from './state.js';

const scenario = generateScenario(CLASSIC_34, 'log-probe');
const seats: Seat[] = ['p1', 'p2', 'p3'].map((id, index) => ({
  id,
  name: `Spieler ${index + 1}`,
  color: seatColorAt(index),
}));
const ids = seats.map((seat) => seat.id);

/** Das handgelegte Brett aus `fixtures.ts` benutzt eigene Spieler-Ids. */
const testSeats: Seat[] = ['p1', 'p2', 'p3'].map((id, index) => ({
  id,
  name: id,
  color: seatColorAt(index),
}));

function apply(state: GameState, action: GameAction): GameState {
  const result = reduce(state, action);
  if (!result.ok) throw new Error(result.error.message);
  return result.state;
}

describe('Verlaufssaetze', () => {
  it('nennt die Gruendungssiedlung beim Namen des Spielers', () => {
    const before = afterOpening(createGame(scenario, CLASSIC_RULES, ids, 'log-probe'));
    const actor = setupPlayer(before)!;
    const action = legalActions(before, actor)[0]!;
    const after = apply(before, action);

    // Wer zuerst setzt, hat der Auftakt entschieden - der Name kommt deshalb
    // aus dem Sitz und steht nicht fest im Test.
    const name = seats.find((seat) => seat.id === actor)!.name;
    expect(describeTransition(before, action, after, seats)).toContain(name);
    expect(describeTransition(before, action, after, seats)).toContain('Gründungssiedlung');
  });

  it('nennt beim Wurf die Augenzahl', () => {
    let state = afterOpening(createGame(scenario, CLASSIC_RULES, ids, 'log-probe'));
    while (state.phase.kind === 'setup') {
      state = apply(state, legalActions(state, setupPlayer(state)!)[0]!);
    }

    const player = state.players[state.currentPlayerIndex]!.id;
    const action: GameAction = { type: 'rollDice', player };
    const after = apply(state, action);
    const sum = yieldTotal(after.rules.dice, after.lastRoll!);

    expect(describeTransition(state, action, after, seats)).toContain(String(sum));
  });

  it('meldet den Sieg an dem Zug, mit dem er faellt', () => {
    /*
     * Der Sieg stand einmal nur beim Zugende - und konnte dort gar nicht
     * auftreten, weil `reduce` ihn nur fuer den Spieler am Zug prueft und das
     * beim Zugende schon der naechste ist. Gewonnen wird mit einer Stadt, einer
     * Karte, einem Ritter; der Verlauf meldete davon nur den Zug.
     */
    const base = testGame({
      rules: { ...CLASSIC_RULES, victoryPointGoal: 2 },
      phase: { kind: 'main' },
      currentPlayerIndex: 0,
      buildings: {
        [CENTER_VERTEX]: { owner: 'p1', kind: 'settlement', wall: false, metropolis: null },
      },
    });
    const before = giving(base, 'p1', { grain: 2, ore: 3 });
    const action: GameAction = { type: 'buildCity', player: 'p1', vertex: CENTER_VERTEX };
    const after = apply(before, action);

    expect(after.phase.kind).toBe('finished');
    expect(describeTransition(before, action, after, testSeats)).toBe(
      'p1 baut eine Stadt - und gewinnt die Partie',
    );
  });

  it('faellt fuer unbekannte Sitze auf die Id zurueck statt zu werfen', () => {
    const before = afterOpening(createGame(scenario, CLASSIC_RULES, ids, 'log-probe'));
    const action = legalActions(before, setupPlayer(before)!)[0]!;
    const after = apply(before, action);

    expect(describeTransition(before, action, after, [])).toContain(action.player);
  });
});

describe('Verlaufssaetze zum Spielerhandel', () => {
  const offer: GameAction = {
    type: 'offerTrade',
    player: 'p1',
    give: hand({ lumber: 2 }),
    want: hand({ ore: 1 }),
    at: 0,
  };

  /** p1 bietet, p2 kann zahlen. */
  function table(): GameState {
    return giving(giving(testGame(), 'p1', { lumber: 3 }), 'p2', { ore: 2 });
  }

  function step(state: GameState, action: GameAction): { state: GameState; entry: string } {
    const result = reduce(state, action);
    if (!result.ok) throw new Error(`${action.type}: ${result.error.message}`);
    return {
      state: result.state,
      entry: describeTransition(state, action, result.state, testSeats),
    };
  }

  it('nennt beide Seiten beim Angebot', () => {
    expect(step(table(), offer).entry).toContain('bietet');
  });

  it('nennt den Partner beim Zuschlag', () => {
    const offered = step(table(), offer);
    const answered = step(offered.state, {
      type: 'respondTrade',
      player: 'p2',
      response: 'accepted',
    });
    const done = step(answered.state, { type: 'acceptTrade', player: 'p1', partner: 'p2' });

    expect(answered.entry).toBe('p2 nimmt das Angebot an');
    expect(done.entry).toBe('p1 tauscht mit p2');
  });

  it('nennt den Fristablauf mit dem Anbieter', () => {
    const offered = step(table(), offer);
    const due = offered.state.phase.kind === 'tradePending' ? offered.state.phase.expiresAt : 0;

    expect(step(offered.state, { type: 'timeout', player: 'p1', at: due }).entry).toContain(
      'abgelaufen',
    );
  });

  it('nennt Weggehen und Wiederkommen', () => {
    const offered = step(table(), offer);
    const gone = step(offered.state, { type: 'dropFromTrade', player: 'p2' });
    const back = step(gone.state, { type: 'rejoinTrade', player: 'p2' });

    expect(gone.entry).toContain('nicht mehr da');
    expect(back.entry).toContain('zurück');
  });
});

describe('der Verlaufssatz im Auftakt', () => {
  const auftakt = (pending: string[], rolls = {}) =>
    testGame({
      phase: { kind: 'opening', rolls, pending, round: 0 },
      turn: 0,
    });

  it('nennt den Wurf und nicht den Ertrag', () => {
    const before = auftakt(['p1', 'p2', 'p3']);
    const action: GameAction = { type: 'rollDice', player: 'p1' };
    const after = apply(before, action);

    const text = describeTransition(before, action, after, seats);

    expect(text).toContain('Auftakt');
    expect(text).toContain(String(yieldTotal(after.rules.dice, after.lastRoll!)));
  });

  it('sagt, wer beginnt, sobald es entschieden ist', () => {
    let state = auftakt(['p1', 'p2', 'p3']);
    let text = '';

    for (const player of ['p1', 'p2', 'p3']) {
      const action: GameAction = { type: 'rollDice', player };
      const after = apply(state, action);
      text = describeTransition(state, action, after, seats);
      state = after;
    }

    // Entweder ist entschieden oder es wird gestochen - der Satz muss beides
    // sagen koennen, sonst steht am Ende einer Runde nur eine nackte Zahl.
    expect(text).toMatch(/beginnt|Stechen/);
  });
});

/**
 * Die Ritter im Verlauf.
 *
 * `describeTransition` liest aus dem Uebergang und nicht aus der Absicht -
 * deshalb bekommt jeder Fall einen echten Vorher- und einen echten
 * Nachher-Zustand, gebaut mit denselben `apply…`-Funktionen wie im Spiel.
 */
describe('Verlaufssaetze fuer Staedte & Ritter', () => {
  const CHAIN = ['e:0,0|1,-1', 'e:0,-1|0,0', 'e:-1,0|0,0'];
  const CORNERS = ['v:0,0|1,-1|1,0', 'v:0,-1|0,0|1,-1', 'v:-1,0|0,-1|0,0', 'v:-1,0|-1,1|0,0'];

  function knight(owner: string, level: 1 | 2 | 3, active: boolean, turn = 1) {
    return {
      owner,
      level,
      active,
      activatedOnTurn: active ? turn : null,
      upgradedThisTurn: false,
    };
  }

  /** Der Satz zu einem Zug, gefahren durch den echten Reducer. */
  function sentenceFor(state: GameState, action: GameAction): string {
    const result = reduce(state, action);
    if (!result.ok) throw new Error(`${action.type}: ${result.error.message}`);
    return describeTransition(state, action, result.state, testSeats);
  }

  const withRoads = (extra: Partial<GameState> = {}): GameState =>
    gameWithCities({ roads: Object.fromEntries(CHAIN.map((edge) => [edge, 'p1'])), ...extra });

  it('meldet den Ritterbau', () => {
    const state = giving(withRoads(), 'p1', hand({ wool: 1, ore: 1 }));
    expect(sentenceFor(state, { type: 'buildKnight', player: 'p1', vertex: CORNERS[3]! })).toBe(
      'p1 baut einen Ritter',
    );
  });

  it('meldet die Stadtmauer', () => {
    const state = giving(withRoads(), 'p1', hand({ brick: 2 }));
    expect(sentenceFor(state, { type: 'buildWall', player: 'p1', vertex: CENTER_VERTEX })).toBe(
      'p1 baut eine Stadtmauer',
    );
  });

  it('meldet den Helm', () => {
    const state = giving(
      withRoads({ knights: { [CORNERS[3]!]: knight('p1', 1, false) } }),
      'p1',
      hand({ grain: 1 }),
    );
    expect(sentenceFor(state, { type: 'activateKnight', player: 'p1', vertex: CORNERS[3]! })).toBe(
      'p1 setzt einem Ritter den Helm auf',
    );
  });

  it('meldet die neue Stufe beim Aufwerten', () => {
    const state = giving(
      withRoads({ knights: { [CORNERS[3]!]: knight('p1', 1, false) } }),
      'p1',
      hand({ wool: 1, ore: 1 }),
    );
    expect(sentenceFor(state, { type: 'upgradeKnight', player: 'p1', vertex: CORNERS[3]! })).toBe(
      'p1 wertet einen Ritter zum Starken Ritter auf',
    );
  });

  it('meldet das Versetzen', () => {
    const state = withRoads({
      buildings: {},
      knights: { [CORNERS[0]!]: knight('p1', 1, true) },
      turn: 2,
    });
    const move = { type: 'moveKnight', player: 'p1', from: CORNERS[0]!, to: CORNERS[2]! } as const;
    expect(sentenceFor(state, move)).toBe('p1 versetzt einen Ritter');
  });

  it('meldet das Vertreiben mit dem Namen des Getroffenen', () => {
    const state = withRoads({
      buildings: {},
      knights: { [CORNERS[0]!]: knight('p1', 2, true), [CORNERS[2]!]: knight('p2', 1, false) },
      turn: 2,
    });
    const move = { type: 'moveKnight', player: 'p1', from: CORNERS[0]!, to: CORNERS[2]! } as const;
    expect(sentenceFor(state, move)).toBe('p1 vertreibt p2s Ritter');
  });

  it('meldet das Ausweichen', () => {
    const state = gameWithCities({
      buildings: {},
      roads: Object.fromEntries(CHAIN.map((edge) => [edge, 'p2'])),
      knights: {},
      phase: {
        kind: 'displacePending',
        owner: 'p2',
        level: 1,
        active: false,
        activatedOnTurn: null,
        from: CORNERS[0]!,
      },
    });
    const place = { type: 'placeDisplacedKnight', player: 'p2', vertex: CORNERS[2]! } as const;
    expect(sentenceFor(state, place)).toBe('p2 weicht mit seinem Ritter aus');
  });

  it('meldet die Raeuberjagd', () => {
    const state = withRoads({
      knights: { [CORNERS[0]!]: knight('p1', 1, true) },
      barbarians: { position: 0, attacks: 1 },
      robber: '0,0',
      turn: 2,
    });
    expect(sentenceFor(state, { type: 'chaseRobber', player: 'p1', vertex: CORNERS[0]! })).toBe(
      'p1 schickt einen Ritter hinter dem Räuber her',
    );
  });

  it('meldet den Stadtausbau mit dem Namen der erreichten Stufe - im Akkusativ', () => {
    const state = giving(withRoads(), 'p1', hand({ cloth: 1 }));
    expect(sentenceFor(state, { type: 'improveCity', player: 'p1', track: 'trade' })).toBe(
      'p1 baut den Markt',
    );
  });

  it('meldet die Metropole, wenn dieser Ausbau sie einbringt', () => {
    const withLevel: GameState = {
      ...withRoads(),
      players: withRoads().players.map((player) =>
        player.id === 'p1' ? { ...player, improvements: { trade: 3 } } : player,
      ),
    };
    const state = giving(withLevel, 'p1', hand({ cloth: 4 }));
    expect(
      sentenceFor(state, {
        type: 'improveCity',
        player: 'p1',
        track: 'trade',
        metropolisAt: CENTER_VERTEX,
      }),
    ).toBe('p1 baut die Bank und setzt darauf die Metropole');
  });
});

/**
 * Der Ueberfall haengt am Wurfsatz.
 *
 * Der Wurf entsteht aus dem Zufallszustand, also wird ein Seed gesucht, bei dem
 * eine Schiffsseite faellt - der Rest des Satzes folgt aus dem Uebergang.
 */
describe('Der Ueberfall im Verlauf', () => {
  function landingSentence(state: GameState): string | null {
    for (let seed = 0; seed < 200; seed += 1) {
      const ready: GameState = {
        ...state,
        phase: { kind: 'rollPending' },
        rng: createRng(`ueberfall-${seed}`),
      };
      const action = { type: 'rollDice', player: 'p1' } as const;
      const result = reduce(ready, action);
      if (!result.ok) continue;

      const face = result.state.lastRoll?.find((entry) => entry.die === 'event')?.value ?? 6;
      if (face > 3) continue;

      return describeTransition(ready, action, result.state, testSeats);
    }
    return null;
  }

  /** Ein Feld vor der Kueste - der naechste Schiffswurf laesst sie landen. */
  const AT_COAST = { position: CITIES_RULES.barbarianTrack - 1, attacks: 0 };

  it('erzaehlt, dass die Ritter gehalten haben, und nennt den Retter', () => {
    const state = gameWithCities({
      barbarians: AT_COAST,
      buildings: { [CENTER_VERTEX]: { owner: 'p1', kind: 'city', wall: false, metropolis: null } },
      knights: {
        'v:-1,0|-1,1|0,0': {
          owner: 'p2',
          level: 2,
          active: true,
          activatedOnTurn: 1,
          upgradedThisTurn: false,
        },
      },
      turn: 2,
    });

    const sentence = landingSentence(state);
    expect(sentence).not.toBeNull();
    expect(sentence).toContain('die Barbaren landen, die Ritter halten (2 gegen 1)');
    expect(sentence).toContain('p2 wird Retter Catans');
  });

  it('erzaehlt, dass die Barbaren gesiegt haben, und wer eine Stadt verliert', () => {
    const state = gameWithCities({
      barbarians: AT_COAST,
      buildings: {
        [CENTER_VERTEX]: { owner: 'p1', kind: 'city', wall: false, metropolis: null },
        'v:0,-1|0,0|1,-1': { owner: 'p1', kind: 'city', wall: false, metropolis: null },
      },
      knights: {},
      turn: 2,
    });

    const sentence = landingSentence(state);
    expect(sentence).not.toBeNull();
    expect(sentence).toContain('die Barbaren siegen (0 gegen 2)');
    expect(sentence).toContain('p1 verliert eine Stadt');
  });
});

/**
 * Was der Durchgang im Browser gefunden hat.
 *
 * Jeder dieser Tests hält einen Befund fest, den kein bestehender Test
 * gesehen hat — und der Kommentar sagt, wie er im Bild aussah.
 */
describe('Befunde aus dem Browser-Durchgang', () => {
  const RICH = 'v:0,-1|0,0|1,-1';
  const POOR = 'v:-1,1|0,0|0,1';

  function city(owner: string) {
    return { owner, kind: 'city' as const, wall: false, metropolis: null };
  }

  /* Am Bildschirm stand: „Spieler 1 und Spieler 2 und Spieler 3 verliert eine
   * Stadt" - zweimal falsch, in der Aufzählung und im Verb. */
  it('zaehlt mehrere Verlierer mit Komma auf und beugt das Verb', () => {
    const landed: GameState = gameWithCities({
      barbarians: { position: CITIES_RULES.barbarianTrack - 1, attacks: 0 },
      buildings: { [CENTER_VERTEX]: city('p1'), [RICH]: city('p2'), [POOR]: city('p3') },
      knights: {},
      turn: 2,
      phase: { kind: 'rollPending' },
    });

    for (let seed = 0; seed < 200; seed += 1) {
      const ready: GameState = { ...landed, rng: createRng(`browser-${seed}`) };
      const action = { type: 'rollDice', player: 'p1' } as const;
      const result = reduce(ready, action);
      if (!result.ok) continue;
      const face = result.state.lastRoll?.find((e) => e.die === 'event')?.value ?? 6;
      if (face > 3) continue;

      const sentence = describeTransition(ready, action, result.state, testSeats);
      expect(sentence).toContain('p1, p2 und p3 verlieren eine Stadt');
      expect(sentence).not.toContain('und p2 und');
      return;
    }
    throw new Error('kein Wurf mit Schiffsseite gefunden');
  });

  it('beugt das Verb fuer einen einzelnen Verlierer weiter richtig', () => {
    const landed: GameState = gameWithCities({
      barbarians: { position: CITIES_RULES.barbarianTrack - 1, attacks: 0 },
      buildings: { [CENTER_VERTEX]: city('p1'), [RICH]: city('p1') },
      knights: {},
      turn: 2,
      phase: { kind: 'rollPending' },
    });

    for (let seed = 0; seed < 200; seed += 1) {
      const ready: GameState = { ...landed, rng: createRng(`einzeln-${seed}`) };
      const action = { type: 'rollDice', player: 'p1' } as const;
      const result = reduce(ready, action);
      if (!result.ok) continue;
      const face = result.state.lastRoll?.find((e) => e.die === 'event')?.value ?? 6;
      if (face > 3) continue;

      expect(describeTransition(ready, action, result.state, testSeats)).toContain(
        'p1 verliert eine Stadt',
      );
      return;
    }
    throw new Error('kein Wurf mit Schiffsseite gefunden');
  });

  /* Im Verlauf stand „setzt die Gründungssiedlung", auf dem Brett stand eine
   * Stadt - die zweite Setzung ist in Städte & Ritter eine Stadt. */
  it('nennt die zweite Gruendungssetzung eine Stadt', () => {
    const table = gameWithCities({
      buildings: {},
      roads: {},
      knights: {},
      phase: { kind: 'setup', placement: 3, settlement: null },
    });

    expect(setupBuildingKind(table, 3)).toBe('city');

    const actor = setupPlayer(table)!;
    const vertex = legalActions(table, actor).find((a) => a.type === 'placeSetupSettlement')!;
    const result = reduce(table, vertex);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(describeTransition(table, vertex, result.state, testSeats)).toContain(
      'setzt die Gründungsstadt',
    );
  });

  it('nennt die erste Setzung weiterhin eine Siedlung', () => {
    const table = gameWithCities({
      buildings: {},
      roads: {},
      knights: {},
      phase: { kind: 'setup', placement: 0, settlement: null },
    });

    expect(setupBuildingKind(table, 0)).toBe('settlement');

    const actor = setupPlayer(table)!;
    const first = legalActions(table, actor).find((a) => a.type === 'placeSetupSettlement')!;
    const result = reduce(table, first);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(describeTransition(table, first, result.state, testSeats)).toContain(
      'setzt die Gründungssiedlung',
    );
  });

  it('nennt sie an einem Basistisch auch in der zweiten Runde eine Siedlung', () => {
    const basis = testGame({ phase: { kind: 'setup', placement: 3, settlement: null } });
    expect(setupBuildingKind(basis, 3)).toBe('settlement');
  });
});
