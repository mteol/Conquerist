import { describe, expect, it } from 'vitest';

import { CENTER_VERTEX, gameWithCities, giving, hand, testGame } from './fixtures.js';
import type { GameState } from './state.js';
import { distributeYield, grantSetupYield } from './yield.js';

/**
 * Zwei Knoten am Huegelfeld `1,-1` (Chip 6, Lehm), die einander *nicht*
 * benachbart sind - sonst waere die Abstandsregel verletzt und das Brett
 * unmoeglich.
 */
const HILLS_VERTEX_A = CENTER_VERTEX; // Wueste, Huegel 6, Wald 5
const HILLS_VERTEX_B = 'v:0,-1|1,-2|1,-1'; // Weide 8, ausserhalb, Huegel 6

function resourcesOf(state: GameState, id: string) {
  return state.players.find((player) => player.id === id)!.resources;
}

describe('distributeYield', () => {
  it('gibt dem Besitzer einer Siedlung eine Karte je passendem Feld', () => {
    const state = testGame({
      buildings: { [HILLS_VERTEX_A]: { owner: 'p1', kind: 'settlement' } },
    });

    expect(resourcesOf(distributeYield(state, 6), 'p1')).toEqual(hand({ brick: 1 }));
    expect(resourcesOf(distributeYield(state, 5), 'p1')).toEqual(hand({ lumber: 1 }));
  });

  it('gibt einer Stadt zwei Karten', () => {
    const state = testGame({
      buildings: { [HILLS_VERTEX_A]: { owner: 'p1', kind: 'city' } },
    });

    expect(resourcesOf(distributeYield(state, 6), 'p1')).toEqual(hand({ brick: 2 }));
  });

  it('gibt nichts fuer eine Zahl, die auf keinem angrenzenden Feld liegt', () => {
    const state = testGame({
      buildings: { [HILLS_VERTEX_A]: { owner: 'p1', kind: 'settlement' } },
    });

    expect(resourcesOf(distributeYield(state, 4), 'p1')).toEqual(hand());
  });

  it('laesst die Wueste nichts abwerfen', () => {
    // Die Wueste hat keinen Chip - sie kann gar nicht gewuerfelt werden.
    const state = testGame({
      buildings: { [HILLS_VERTEX_A]: { owner: 'p1', kind: 'settlement' } },
    });

    for (const roll of [2, 3, 7, 11, 12]) {
      expect(resourcesOf(distributeYield(state, roll), 'p1')).toEqual(hand());
    }
  });

  it('sperrt das Feld, auf dem der Raeuber steht', () => {
    const state = testGame({
      buildings: { [HILLS_VERTEX_A]: { owner: 'p1', kind: 'settlement' } },
      robber: '1,-1',
    });

    expect(resourcesOf(distributeYield(state, 6), 'p1')).toEqual(hand());
    // Das Nachbarfeld liefert weiter.
    expect(resourcesOf(distributeYield(state, 5), 'p1')).toEqual(hand({ lumber: 1 }));
  });

  it('bedient mehrere Spieler am selben Feld', () => {
    const state = testGame({
      buildings: {
        [HILLS_VERTEX_A]: { owner: 'p1', kind: 'settlement' },
        [HILLS_VERTEX_B]: { owner: 'p2', kind: 'city' },
      },
    });

    const next = distributeYield(state, 6);
    expect(resourcesOf(next, 'p1')).toEqual(hand({ brick: 1 }));
    expect(resourcesOf(next, 'p2')).toEqual(hand({ brick: 2 }));
  });

  it('nimmt die ausgegebenen Karten aus der Bank', () => {
    const state = testGame({
      buildings: { [HILLS_VERTEX_A]: { owner: 'p1', kind: 'city' } },
    });

    const next = distributeYield(state, 6);
    expect(next.bank.brick).toBe(state.bank.brick - 2);
    expect(next.bank.lumber).toBe(state.bank.lumber);
  });

  it('laesst den Zustand im uebrigen unberuehrt', () => {
    const state = testGame({
      buildings: { [HILLS_VERTEX_A]: { owner: 'p1', kind: 'settlement' } },
    });
    const before = JSON.stringify(state);

    distributeYield(state, 6);
    expect(JSON.stringify(state)).toBe(before);
  });

  describe('wenn die Bank knapp wird', () => {
    it('gibt einem einzelnen Anspruchsberechtigten, was noch da ist', () => {
      const state = testGame({
        buildings: { [HILLS_VERTEX_A]: { owner: 'p1', kind: 'city' } },
        bank: hand({ brick: 1, lumber: 19, wool: 19, grain: 19, ore: 19 }),
      });

      const next = distributeYield(state, 6);
      expect(resourcesOf(next, 'p1')).toEqual(hand({ brick: 1 }));
      expect(next.bank.brick).toBe(0);
    });

    it('gibt niemandem etwas, wenn mehrere Anspruch haetten', () => {
      // Originalregel: reicht der Vorrat nicht fuer alle, geht die ganze
      // Ressource in dieser Runde an niemanden.
      const state = testGame({
        buildings: {
          [HILLS_VERTEX_A]: { owner: 'p1', kind: 'settlement' },
          [HILLS_VERTEX_B]: { owner: 'p2', kind: 'city' },
        },
        bank: hand({ brick: 2, lumber: 19, wool: 19, grain: 19, ore: 19 }),
      });

      const next = distributeYield(state, 6);
      expect(resourcesOf(next, 'p1')).toEqual(hand());
      expect(resourcesOf(next, 'p2')).toEqual(hand());
      expect(next.bank.brick).toBe(2);
    });

    it('bedient andere Ressourcen desselben Wurfs trotzdem', () => {
      const state = testGame({
        buildings: {
          [HILLS_VERTEX_A]: { owner: 'p1', kind: 'settlement' },
          [HILLS_VERTEX_B]: { owner: 'p2', kind: 'settlement' },
        },
        bank: hand({ brick: 1, lumber: 19, wool: 19, grain: 19, ore: 19 }),
      });

      // Wurf 8 trifft die Weide, an der nur p2 sitzt - davon ist die Knappheit
      // beim Lehm unberuehrt.
      const next = distributeYield(state, 8);
      expect(resourcesOf(next, 'p2')).toEqual(hand({ wool: 1 }));
    });
  });
});

describe('grantSetupYield', () => {
  it('gibt eine Karte je angrenzendem Ertragsfeld', () => {
    // Die zweite Siedlung der Gruendungsphase bringt sofort Ertrag:
    // Huegel (Lehm) und Wald (Holz), die Wueste nichts.
    const state = testGame({
      buildings: { [CENTER_VERTEX]: { owner: 'p1', kind: 'settlement' } },
    });

    const next = grantSetupYield(state, 'p1', CENTER_VERTEX);
    expect(resourcesOf(next, 'p1')).toEqual(hand({ brick: 1, lumber: 1 }));
  });

  it('nimmt die Karten aus der Bank', () => {
    const state = testGame();
    const next = grantSetupYield(state, 'p1', CENTER_VERTEX);

    expect(next.bank.brick).toBe(state.bank.brick - 1);
    expect(next.bank.lumber).toBe(state.bank.lumber - 1);
  });

  it('gibt nur, was die Bank hergibt', () => {
    const state = testGame({ bank: hand({ lumber: 1 }) });
    const next = grantSetupYield(state, 'p1', CENTER_VERTEX);

    expect(resourcesOf(next, 'p1')).toEqual(hand({ lumber: 1 }));
    expect(next.bank.lumber).toBe(0);
  });

  it('laesst bereits vorhandene Karten stehen', () => {
    const state = giving(testGame(), 'p1', { ore: 3 });
    const next = grantSetupYield(state, 'p1', CENTER_VERTEX);

    expect(resourcesOf(next, 'p1')).toEqual(hand({ ore: 3, brick: 1, lumber: 1 }));
  });
});

/**
 * Der Stadtertrag in Staedte & Ritter.
 *
 * Zwei Karten wie bisher - aber an Wald, Weideland und Gebirge ist die zweite
 * eine Handelsware. Ein Verzicht zugunsten von zwei gleichen Karten ist nicht
 * erlaubt, deshalb gibt es hier keine Wahl.
 */
describe('Handelswaren am Stadtertrag', () => {
  it('gibt der Stadt am Wald ein Holz und ein Papier', () => {
    const state = gameWithCities();

    expect(resourcesOf(distributeYield(state, 5), 'p1')).toEqual(hand({ lumber: 1, paper: 1 }));
  });

  it('gibt der Stadt am Huegelland weiterhin zwei Lehm', () => {
    const state = gameWithCities();

    expect(resourcesOf(distributeYield(state, 6), 'p1')).toEqual(hand({ brick: 2 }));
  });

  it('gibt der Siedlung am Wald nur das Holz', () => {
    const state = gameWithCities({
      buildings: { [CENTER_VERTEX]: { owner: 'p1', kind: 'settlement' } },
    });

    expect(resourcesOf(distributeYield(state, 5), 'p1')).toEqual(hand({ lumber: 1 }));
  });

  /*
   * Am Basistisch steht die Handelsware nicht in `rules.cards` - dann bleibt
   * es bei zwei gleichen Rohstoffen, ohne dass irgendwo ein Sonderfall steht.
   */
  it('bleibt am Basistisch bei zwei Holz', () => {
    const state = testGame({
      buildings: { [CENTER_VERTEX]: { owner: 'p1', kind: 'city' } },
    });

    expect(resourcesOf(distributeYield(state, 5), 'p1')).toEqual(hand({ lumber: 2 }));
  });

  /*
   * Holz und Papier sind zwei Sorten. Geht das Papier aus, faellt das Holz
   * nicht mit aus - obwohl beide vom selben Feld kommen.
   */
  it('behandelt Rohstoff und Handelsware als getrennte Vorraete', () => {
    const state = gameWithCities({ bank: hand({ lumber: 19, paper: 0 }) });

    expect(resourcesOf(distributeYield(state, 5), 'p1')).toEqual(hand({ lumber: 1 }));
  });

  /* Die Gruendung gibt einen Rohstoff je Feld - Handelswaren sind nicht dabei. */
  it('gibt beim Start keine Handelswaren', () => {
    const state = gameWithCities({ buildings: {} });
    const nachher = grantSetupYield(state, 'p1', CENTER_VERTEX);

    expect(resourcesOf(nachher, 'p1')).toEqual(hand({ brick: 1, lumber: 1 }));
  });
});
