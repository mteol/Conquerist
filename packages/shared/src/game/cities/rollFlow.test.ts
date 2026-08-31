import { describe, expect, it } from 'vitest';

import { CITIES_RULES } from '../../rules/index.js';
import type { Roll } from '../dice.js';
import { testGame } from '../fixtures.js';
import type { PlayerId, PlayerState } from '../player.js';
import type { GameState } from '../state.js';
import type { ProgressCardId } from './progress/cards.js';
import {
  applyDiscardProgressCard,
  applyPickAqueduct,
  applyPickProgressDeck,
  continueAfterAqueduct,
  continueAfterDefender,
  continueAfterEvent,
  continueAfterProgressDiscard,
} from './rollFlow.js';

/*
 * Die Helfer hier sind lokale Aufbauten aus `testGame` - `plainCitiesRoll`,
 * `gateRolled` und `withHand` gibt es nicht als fertige Bausteine. Der Tisch
 * hat drei Spieler in der Reihenfolge p1, p2, p3, und p1 ist am Zug: p2 und p3
 * sind damit die, die abgeben muessen, wenn ihre Hand zu voll ist.
 */

/** Ein Wurf mit dieser Augensumme - ohne Ereigniswuerfel, der faellt hier nicht. */
function rollOf(total: number): Roll {
  return [
    { die: 'first', value: Math.ceil(total / 2) },
    { die: 'second', value: Math.floor(total / 2) },
  ];
}

/** Der Knoten an Weide 8 und Huegel 6: bei 8 gibt es Wolle, bei 6 Lehm. */
const PASTURE_VERTEX = 'v:0,-1|1,-2|1,-1';

function settlementOf(owner: PlayerId) {
  return { owner, kind: 'settlement' as const, wall: false, metropolis: null };
}

/**
 * Ein Staedte-&-Ritter-Tisch mitten im Wurf: p1 ist am Zug, sein Haus liegt an
 * Weide 8, und der letzte Wurf steht schon im Zustand - die Kette liest ihn
 * dort, statt ihn mitzuschleppen.
 */
function plainCitiesRoll(overrides: Partial<GameState> = {}): GameState {
  return testGame({
    rules: CITIES_RULES,
    barbarians: { position: 0, attacks: 1 },
    buildings: { [PASTURE_VERTEX]: settlementOf('p1') },
    progressDecks: { science: ['crane', 'mining'], trade: ['merchant'], politics: ['warlord'] },
    lastRoll: rollOf(8),
    ...overrides,
  });
}

/** Derselbe Tisch, nachdem am Stadttor gezogen wurde. */
function gateRolled(overrides: Partial<GameState> = {}): GameState {
  return plainCitiesRoll(overrides);
}

function withHand(state: GameState, id: PlayerId, cards: ProgressCardId[]): GameState {
  return {
    ...state,
    players: state.players.map((player) =>
      player.id === id ? { ...player, progressCards: cards } : player,
    ),
  };
}

function withScience(state: GameState, id: PlayerId, level: number): GameState {
  return {
    ...state,
    players: state.players.map((player) =>
      player.id === id
        ? { ...player, improvements: { ...player.improvements, science: level } }
        : player,
    ),
  };
}

function playerNamed(state: GameState, id: PlayerId): PlayerState {
  const player = state.players.find((candidate) => candidate.id === id);
  if (player === undefined) throw new Error(`playerNamed: ${id} sitzt nicht am Tisch`);
  return player;
}

/** Fuenf zaehlende Karten - eine mehr, als das Limit erlaubt. */
const fiveCards: ProgressCardId[] = ['crane', 'mining', 'smith', 'medicine', 'warlord'];

/** p2 hat abgegeben und haelt wieder vier; der Wurf war eine Sechs. */
const afterDiscarding = withHand(
  plainCitiesRoll({
    lastRoll: rollOf(6),
    phase: { kind: 'progressDiscardPending', pending: ['p2'] },
  }),
  'p2',
  ['crane', 'mining', 'smith', 'medicine'],
);

/** p1 hat das Aquaedukt und liegt an keinem Feld mit der Acht. */
function aqueductHolderGetsNothing(): GameState {
  return withScience(plainCitiesRoll({ buildings: {} }), 'p1', 3);
}

/** Die Rohstoffwahl am Aquaedukt ist getroffen, die Warteschlange ist leer. */
const aqueductAnswered = plainCitiesRoll({ phase: { kind: 'aqueductPending', pending: [] } });

/** Die Stapelwahl der Verteidiger ist durch - und p2 haelt jetzt fuenf Karten. */
const defenderDrewFifthCard = withHand(
  plainCitiesRoll({ phase: { kind: 'defenderPending', pending: [] } }),
  'p2',
  fiveCards,
);

describe('Die Kette in einem Wurf', () => {
  it('geht ohne offene Wahl vom Ereignis bis in die Hauptphase', () => {
    const after = continueAfterEvent(plainCitiesRoll(), 8);
    expect(after.phase.kind).toBe('main');
  });

  it('haelt beim Abgeben der fuenften Karte an, bevor die Ertraege fallen', () => {
    // p2 ist nicht am Zug und haelt nach dem Zug fuenf zaehlende Karten.
    const before = withHand(gateRolled(), 'p2', [
      'crane',
      'mining',
      'smith',
      'medicine',
      'warlord',
    ]);
    const after = continueAfterEvent(before, 8);
    expect(after.phase).toEqual({ kind: 'progressDiscardPending', pending: ['p2'] });
    // Die Ertraege sind noch nicht verteilt.
    expect(playerNamed(after, 'p1').resources).toEqual(playerNamed(before, 'p1').resources);
  });

  it('verteilt die Ertraege erst, wenn abgegeben wurde', () => {
    const after = continueAfterProgressDiscard(afterDiscarding);
    expect(playerNamed(after, 'p1').resources.brick).toBe(1);
  });

  it('haelt am Aquaedukt an, wenn jemand leer ausging', () => {
    const after = continueAfterEvent(aqueductHolderGetsNothing(), 8);
    expect(after.phase).toEqual({ kind: 'aqueductPending', pending: ['p1'] });
  });

  it('geht vom Aquaedukt in die Hauptphase', () => {
    expect(continueAfterAqueduct(aqueductAnswered).phase.kind).toBe('main');
  });

  /*
   * Der schwierige Fall, und der Grund fuer diese Aufgabe: die Stapelwahl der
   * Verteidiger verteilt selbst Karten und kann damit erst das Handlimit
   * reissen. Eine vor der Phase gebildete Liste waere hier falsch.
   */
  it('schickt vom Stapelwahl-Ende in das Abgeben, wenn die Karte das Limit reisst', () => {
    const after = continueAfterDefender(defenderDrewFifthCard);
    expect(after.phase).toEqual({ kind: 'progressDiscardPending', pending: ['p2'] });
  });

  /* Wer am Zug ist, gibt nicht ab - er spielt sofort, und das kann er in `main`. */
  it('nimmt den Spieler am Zug aus der Abgabeliste heraus', () => {
    const after = continueAfterEvent(withHand(gateRolled(), 'p1', fiveCards), 8);
    expect(after.phase.kind).toBe('main');
  });

  /*
   * Die Ertraege duerfen genau einmal fallen. Verteilte `continueAfterEvent`
   * sie und `continueAfterProgressDiscard` noch einmal, haette p1 zwei Wolle
   * statt einer - der teuerste stille Fehler dieser Kette.
   */
  it('verteilt die Ertraege genau einmal, wenn niemand abgeben muss', () => {
    const after = continueAfterEvent(plainCitiesRoll(), 8);
    expect(playerNamed(after, 'p1').resources.wool).toBe(1);
  });

  /*
   * Die Sieben nimmt ihren eigenen Weg wieder auf: sie verteilt keinen Ertrag,
   * an dem "leer ausgegangen" etwas bedeuten wuerde, und schuldet stattdessen
   * den Raeuber. Ohne diesen Zweig fiele der Raeuber nach einem Gleichstand in
   * der Verteidigung lautlos aus.
   */
  it('gibt die Sieben nach der Stapelwahl an den Raeuber zurueck', () => {
    const seven = plainCitiesRoll({
      lastRoll: rollOf(7),
      phase: { kind: 'defenderPending', pending: [] },
    });

    expect(continueAfterDefender(seven).phase.kind).toBe('robberPending');
  });
});

describe('Die Stapelwahl der Verteidiger', () => {
  const tie = plainCitiesRoll({ phase: { kind: 'defenderPending', pending: ['p1', 'p2'] } });

  it('legt die oberste Karte des gewaehlten Stapels auf die Hand', () => {
    const result = applyPickProgressDeck(tie, 'p1', 'science');
    if (!result.ok) throw new Error(result.error.message);

    expect(playerNamed(result.state, 'p1').progressCards).toEqual(['crane']);
    expect(result.state.progressDecks.science).toEqual(['mining']);
  });

  it('laesst danach den naechsten Beteiligten waehlen', () => {
    const result = applyPickProgressDeck(tie, 'p1', 'science');
    if (!result.ok) throw new Error(result.error.message);

    expect(result.state.phase).toEqual({ kind: 'defenderPending', pending: ['p2'] });
  });

  /*
   * Buchdruck und Verfassung liegen laut Anleitung sofort beim Ziehen offen -
   * auch auf diesem zweiten Ziehpfad, nicht nur am Stadttor.
   */
  it('legt eine gezogene Siegpunktkarte sofort offen ab statt auf die Hand', () => {
    const withPrinter = plainCitiesRoll({
      phase: { kind: 'defenderPending', pending: ['p1', 'p2'] },
      progressDecks: { science: ['printer'], trade: ['merchant'], politics: ['warlord'] },
    });
    const result = applyPickProgressDeck(withPrinter, 'p1', 'science');
    if (!result.ok) throw new Error(result.error.message);

    expect(playerNamed(result.state, 'p1').progressCards).toEqual([]);
    expect(playerNamed(result.state, 'p1').openProgressCards).toEqual(['printer']);
  });

  it('weist ab, wer nicht an der Reihe ist', () => {
    expect(applyPickProgressDeck(tie, 'p2', 'science').ok).toBe(false);
  });

  it('weist einen leeren Stapel ab', () => {
    const empty = plainCitiesRoll({
      phase: { kind: 'defenderPending', pending: ['p1'] },
      progressDecks: { science: [] },
    });

    expect(applyPickProgressDeck(empty, 'p1', 'science').ok).toBe(false);
  });
});

describe('Das Abgeben der fuenften Karte', () => {
  const over = withHand(
    plainCitiesRoll({ phase: { kind: 'progressDiscardPending', pending: ['p2'] } }),
    'p2',
    fiveCards,
  );

  /* Der Stapel waechst nie nach - dieselbe Zusage, die `drawProgressCards` gibt. */
  it('nimmt die Karte aus dem Spiel, statt sie zurueckzulegen', () => {
    const result = applyDiscardProgressCard(over, 'p2', 'crane');
    if (!result.ok) throw new Error(result.error.message);

    expect(playerNamed(result.state, 'p2').progressCards).not.toContain('crane');
    expect(result.state.progressDecks.science).toEqual(['crane', 'mining']);
  });

  it('geht danach weiter zu den Ertraegen', () => {
    const result = applyDiscardProgressCard(over, 'p2', 'crane');
    if (!result.ok) throw new Error(result.error.message);

    expect(result.state.phase.kind).toBe('main');
    expect(playerNamed(result.state, 'p1').resources.wool).toBe(1);
  });

  it('weist eine Karte ab, die gar nicht auf der Hand liegt', () => {
    expect(applyDiscardProgressCard(over, 'p2', 'bishop').ok).toBe(false);
  });

  it('weist eine Siegpunktkarte ab - sie zaehlt nicht zum Limit', () => {
    const withVictory = withHand(over, 'p2', [...fiveCards, 'printer']);
    expect(applyDiscardProgressCard(withVictory, 'p2', 'printer').ok).toBe(false);
  });
});

describe('Die Rohstoffwahl am Aquaedukt', () => {
  const pending = withScience(
    plainCitiesRoll({ buildings: {}, phase: { kind: 'aqueductPending', pending: ['p1'] } }),
    'p1',
    3,
  );

  it('gibt den gewaehlten Rohstoff aus der Bank', () => {
    const result = applyPickAqueduct(pending, 'p1', 'ore');
    if (!result.ok) throw new Error(result.error.message);

    expect(playerNamed(result.state, 'p1').resources.ore).toBe(1);
    expect(result.state.bank.ore).toBe(pending.bank.ore - 1);
    expect(result.state.phase.kind).toBe('main');
  });

  it('weist eine leere Bank ab', () => {
    const empty: GameState = { ...pending, bank: { ...pending.bank, ore: 0 } };
    expect(applyPickAqueduct(empty, 'p1', 'ore').ok).toBe(false);
  });

  it('weist ab, wer gar nichts zu waehlen hat', () => {
    expect(applyPickAqueduct(pending, 'p2', 'ore').ok).toBe(false);
  });

  /*
   * Zwei Anspruchsberechtigte warten nacheinander: der erste Eintrag waehlt,
   * und erst wenn er gewaehlt hat, ist der zweite an der Reihe. Ohne die
   * Reihenfolge koennten beide dieselbe letzte Karte der Bank nehmen.
   */
  it('reiht mehrere Anspruchsberechtigte hintereinander auf', () => {
    const both = withScience(withScience(plainCitiesRoll({ buildings: {} }), 'p1', 3), 'p2', 3);
    const after = continueAfterEvent(both, 8);

    expect(after.phase).toEqual({ kind: 'aqueductPending', pending: ['p1', 'p2'] });
  });
});
