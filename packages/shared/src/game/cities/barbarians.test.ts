import { describe, expect, it } from 'vitest';

import { CITIES_RULES } from '../../rules/cities.js';
import {
  ADJACENT_VERTEX,
  CENTER_VERTEX,
  FAR_VERTEX,
  gameWithCities,
  testGame,
} from '../fixtures.js';
import type { Building, GameState, Knight, KnightLevel } from '../state.js';
import {
  advanceShip,
  applyBarbarianAttack,
  barbarianOutcome,
  barbarianStrength,
  defenseContributions,
  hasLanded,
  robberIsFree,
} from './barbarians.js';

describe('Barbarenschiff', () => {
  it('startet auf dem ersten Feld', () => {
    expect(gameWithCities().barbarians).toEqual({ position: 0, attacks: 0 });
  });

  it('faehrt Feld um Feld', () => {
    let state = gameWithCities();

    state = advanceShip(state);
    expect(state.barbarians?.position).toBe(1);

    state = advanceShip(state);
    expect(state.barbarians?.position).toBe(2);
  });

  /* Die Wartelinie aus 10a ist weg - seit es Ritter gibt, faehrt es durch. */
  it('faehrt bis auf das letzte Feld und landet dort', () => {
    let state = gameWithCities();
    for (let i = 0; i < 20; i += 1) state = advanceShip(state);

    expect(state.barbarians?.position).toBe(CITIES_RULES.barbarianTrack);
    expect(hasLanded(state)).toBe(true);
  });

  it('gilt genau ab dem letzten Feld als gelandet', () => {
    const track = CITIES_RULES.barbarianTrack;
    expect(hasLanded(gameWithCities({ barbarians: { position: track - 1, attacks: 0 } }))).toBe(
      false,
    );
    expect(hasLanded(gameWithCities({ barbarians: { position: track, attacks: 0 } }))).toBe(true);
  });

  it('faehrt an einem Tisch ohne Erweiterung gar nicht', () => {
    const basis = testGame();

    expect(basis.barbarians).toBeNull();
    expect(advanceShip(basis)).toBe(basis);
  });
});

describe('barbarianStrength', () => {
  it('zaehlt jede Stadt auf dem Brett, egal wem sie gehoert', () => {
    const state = gameWithCities({
      buildings: {
        [CENTER_VERTEX]: { owner: 'p1', kind: 'city', wall: false },
        [FAR_VERTEX]: { owner: 'p2', kind: 'city', wall: false },
      },
    });

    expect(barbarianStrength(state)).toBe(2);
  });

  it('zaehlt Siedlungen nicht mit - die Barbaren wollen Staedte', () => {
    const state = gameWithCities({
      buildings: {
        [CENTER_VERTEX]: { owner: 'p1', kind: 'city', wall: false },
        [FAR_VERTEX]: { owner: 'p2', kind: 'settlement', wall: false },
      },
    });

    expect(barbarianStrength(state)).toBe(1);
  });
});

describe('robberIsFree', () => {
  it('haelt den Raeuber fest, bis die Barbaren einmal da waren', () => {
    expect(robberIsFree(gameWithCities())).toBe(false);
  });

  it('gibt ihn nach dem ersten Ueberfall frei', () => {
    const state = gameWithCities({ barbarians: { position: 0, attacks: 1 } });
    expect(robberIsFree(state)).toBe(true);
  });

  /* An einem Basistisch gibt es keine Barbaren, auf die man warten koennte. */
  it('laesst ihn ohne Erweiterung von Anfang an ziehen', () => {
    expect(robberIsFree(testGame())).toBe(true);
  });
});

/**
 * Vier Knoten mit bekanntem Ertragswert (Summe der Augenwahrscheinlichkeit der
 * angrenzenden Zahlenchips, `6 - |7 - n|`) auf dem Testbrett:
 *
 * | Knoten            | Felder                    | Wert |
 * | ----------------- | ------------------------- | ---- |
 * | `RICH`            | Weide 8, Wueste, Huegel 6 |   10 |
 * | `CENTER_VERTEX`   | Wueste, Huegel 6, Wald 5  |    9 |
 * | `ADJACENT_VERTEX` | Wueste, Wald 10, Wald 5   |    7 |
 * | `POOR`            | Berg 4, Wueste, Wald 10   |    6 |
 */
const RICH = 'v:0,-1|0,0|1,-1';
const POOR = 'v:-1,1|0,0|0,1';

function city(owner: string, wall = false): Building {
  return { owner, kind: 'city', wall };
}

function knight(owner: string, level: KnightLevel, active = true): Knight {
  return { owner, level, active, activatedOnTurn: active ? 1 : null, upgradedThisTurn: false };
}

function playerOf(state: GameState, id: string) {
  return state.players.find((player) => player.id === id)!;
}

/** Ein Tisch, an dem das Schiff gerade gelandet ist. */
function landed(overrides: Partial<GameState> = {}): GameState {
  return gameWithCities({
    barbarians: { position: CITIES_RULES.barbarianTrack, attacks: 0 },
    turn: 3,
    ...overrides,
  });
}

describe('defenseContributions', () => {
  it('summiert je Spieler die Stufen seiner aktivierten Ritter', () => {
    const state = landed({
      knights: {
        [CENTER_VERTEX]: knight('p1', 3),
        [ADJACENT_VERTEX]: knight('p1', 1),
        [FAR_VERTEX]: knight('p2', 2),
      },
    });

    const shares = defenseContributions(state);
    expect(shares.get('p1')).toBe(4);
    expect(shares.get('p2')).toBe(2);
    expect(shares.get('p3')).toBe(0);
  });

  it('zaehlt passive Ritter nicht mit', () => {
    const state = landed({ knights: { [CENTER_VERTEX]: knight('p1', 3, false) } });
    expect(defenseContributions(state).get('p1')).toBe(0);
  });
});

describe('barbarianOutcome - die Ritter gewinnen', () => {
  it('gewinnt schon bei Gleichstand', () => {
    const state = landed({
      buildings: { [CENTER_VERTEX]: city('p1'), [RICH]: city('p2') },
      knights: { [ADJACENT_VERTEX]: knight('p1', 2) },
    });

    const outcome = barbarianOutcome(state);
    expect(outcome.barbarians).toBe(2);
    expect(outcome.defenders).toBe(2);
    expect(outcome.won).toBe(true);
    expect(outcome.losses).toEqual([]);
  });

  it('gibt dem alleinigen Hoechstbeitragenden den Retter-Chip', () => {
    const state = landed({
      buildings: { [CENTER_VERTEX]: city('p1') },
      knights: { [ADJACENT_VERTEX]: knight('p1', 1), [POOR]: knight('p2', 2) },
    });

    expect(barbarianOutcome(state).savior).toBe('p2');
  });

  it('gibt bei Gleichstand an der Spitze niemandem einen Chip', () => {
    const state = landed({
      buildings: { [CENTER_VERTEX]: city('p1') },
      knights: { [ADJACENT_VERTEX]: knight('p1', 2), [POOR]: knight('p2', 2) },
    });

    expect(barbarianOutcome(state).savior).toBeNull();
  });

  it('gibt keinen Chip, wenn niemand etwas beigetragen hat', () => {
    // Ohne Staedte ist die Staerke der Barbaren null, und null gegen null
    // gewinnen die Ritter - beigetragen hat trotzdem keiner.
    const state = landed({ buildings: {}, knights: {} });

    const outcome = barbarianOutcome(state);
    expect(outcome.won).toBe(true);
    expect(outcome.savior).toBeNull();
  });
});

describe('barbarianOutcome - die Barbaren gewinnen', () => {
  it('trifft nur Staedtebesitzer', () => {
    const state = landed({
      buildings: {
        [CENTER_VERTEX]: city('p1'),
        [RICH]: city('p1'),
        [FAR_VERTEX]: { owner: 'p2', kind: 'settlement', wall: false },
      },
      knights: {},
    });

    const outcome = barbarianOutcome(state);
    expect(outcome.won).toBe(false);
    expect(outcome.losses.map((loss) => loss.player)).toEqual(['p1']);
  });

  it('trifft unter den Betroffenen den mit den wenigsten Beitragspunkten', () => {
    const state = landed({
      buildings: { [CENTER_VERTEX]: city('p1'), [RICH]: city('p2'), [POOR]: city('p2') },
      knights: { [ADJACENT_VERTEX]: knight('p1', 2) },
    });

    const outcome = barbarianOutcome(state);
    expect(outcome.won).toBe(false);
    expect(outcome.losses.map((loss) => loss.player)).toEqual(['p2']);
  });

  it('trifft bei Gleichstand der Niedrigsten alle von ihnen', () => {
    const state = landed({
      buildings: { [CENTER_VERTEX]: city('p1'), [RICH]: city('p2'), [POOR]: city('p2') },
      knights: {},
    });

    const outcome = barbarianOutcome(state);
    expect(outcome.losses.map((loss) => loss.player).sort()).toEqual(['p1', 'p2']);
  });

  it('nimmt zuerst eine Stadt ohne Mauer', () => {
    const state = landed({
      buildings: { [RICH]: city('p1'), [POOR]: city('p1', true) },
      knights: {},
    });

    expect(barbarianOutcome(state).losses).toEqual([{ player: 'p1', vertex: RICH }]);
  });

  it('nimmt darunter die Stadt mit dem geringsten Ertragswert', () => {
    const state = landed({
      buildings: { [RICH]: city('p1'), [CENTER_VERTEX]: city('p1'), [POOR]: city('p1') },
      knights: {},
    });

    expect(barbarianOutcome(state).losses).toEqual([{ player: 'p1', vertex: POOR }]);
  });

  it('entscheidet bei gleichem Wert nach der kleineren Knoten-Id', () => {
    // ADJACENT_VERTEX und 'v:-1,0|-1,1|0,0' tragen beide den Wert 7.
    const tie = 'v:-1,0|-1,1|0,0';
    const state = landed({
      buildings: { [ADJACENT_VERTEX]: city('p1'), [tie]: city('p1') },
      knights: {},
    });

    const expected = [ADJACENT_VERTEX, tie].sort()[0]!;
    expect(barbarianOutcome(state).losses).toEqual([{ player: 'p1', vertex: expected }]);
  });
});

describe('applyBarbarianAttack', () => {
  it('legt den Retter-Chip beim Sieger ab', () => {
    const state = landed({
      buildings: { [CENTER_VERTEX]: city('p1') },
      knights: { [ADJACENT_VERTEX]: knight('p2', 2) },
    });

    const after = applyBarbarianAttack(state);
    expect(playerOf(after, 'p2').defenderPoints).toBe(1);
    expect(playerOf(after, 'p1').defenderPoints).toBe(0);
  });

  it('macht aus der verlorenen Stadt eine Siedlung und verschiebt den Vorrat', () => {
    const before = landed({ buildings: { [RICH]: city('p1') }, knights: {} });
    const after = applyBarbarianAttack(before);

    expect(after.buildings[RICH]).toEqual({ owner: 'p1', kind: 'settlement', wall: false });
    expect(playerOf(after, 'p1').piecesLeft.city).toBe(playerOf(before, 'p1').piecesLeft.city + 1);
    expect(playerOf(after, 'p1').piecesLeft.settlement).toBe(
      playerOf(before, 'p1').piecesLeft.settlement - 1,
    );
  });

  it('gibt die Mauer mit der Stadt zurueck', () => {
    const before = landed({ buildings: { [RICH]: city('p1', true) }, knights: {} });
    const after = applyBarbarianAttack(before);

    expect(after.buildings[RICH]?.wall).toBe(false);
    expect(playerOf(after, 'p1').piecesLeft.wall).toBe(playerOf(before, 'p1').piecesLeft.wall + 1);
  });

  it('laesst den Siedlungsvorrat nicht unter null fallen', () => {
    const base = landed({ buildings: { [RICH]: city('p1') }, knights: {} });
    const before: GameState = {
      ...base,
      players: base.players.map((player) =>
        player.id === 'p1'
          ? { ...player, piecesLeft: { ...player.piecesLeft, settlement: 0 } }
          : player,
      ),
    };

    const after = applyBarbarianAttack(before);
    expect(after.buildings[RICH]?.kind).toBe('settlement');
    expect(playerOf(after, 'p1').piecesLeft.settlement).toBe(0);
  });

  it('deaktiviert danach alle Ritter aller Spieler', () => {
    const state = landed({
      buildings: { [CENTER_VERTEX]: city('p1') },
      knights: { [ADJACENT_VERTEX]: knight('p1', 2), [POOR]: knight('p2', 1) },
    });

    const after = applyBarbarianAttack(state);
    for (const figure of Object.values(after.knights)) {
      expect(figure.active).toBe(false);
      expect(figure.activatedOnTurn).toBeNull();
    }
  });

  it('schickt das Schiff zurueck auf Feld null und zaehlt den Ueberfall', () => {
    const after = applyBarbarianAttack(landed({ buildings: {}, knights: {} }));

    expect(after.barbarians).toEqual({ position: 0, attacks: 1 });
  });

  it('gibt danach den Raeuber frei', () => {
    const after = applyBarbarianAttack(landed({ buildings: {}, knights: {} }));
    expect(robberIsFree(after)).toBe(true);
  });
});
