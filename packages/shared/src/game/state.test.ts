import { describe, expect, it } from 'vitest';

import { CENTER_VERTEX, testGame } from './fixtures.js';
import { BuildingSchema, GameStateSchema, KnightSchema } from './state.js';

describe('Ritter im Zustand', () => {
  it('kommen als leere Belegung, wenn eine gespeicherte Partie sie nicht kennt', () => {
    const stored = JSON.parse(JSON.stringify(testGame())) as Record<string, unknown>;
    delete stored['knights'];
    expect(GameStateSchema.parse(stored).knights).toEqual({});
  });

  it('tragen Stufe, Helm und den Zug ihrer Aktivierung', () => {
    const knight = KnightSchema.parse({
      owner: 'p1',
      level: 2,
      active: true,
      activatedOnTurn: 4,
      upgradedThisTurn: false,
    });
    expect(knight.level).toBe(2);
    expect(knight.active).toBe(true);
    expect(knight.activatedOnTurn).toBe(4);
  });

  it('kennen keine vierte Stufe', () => {
    expect(() =>
      KnightSchema.parse({
        owner: 'p1',
        level: 4,
        active: false,
        activatedOnTurn: null,
        upgradedThisTurn: false,
      }),
    ).toThrow();
  });

  it('stehen auf Knoten, die eine gespeicherte Partie wiedergibt', () => {
    const state = testGame({
      knights: {
        [CENTER_VERTEX]: {
          owner: 'p1',
          level: 1,
          active: false,
          activatedOnTurn: null,
          upgradedThisTurn: false,
        },
      },
    });
    const parsed = GameStateSchema.parse(JSON.parse(JSON.stringify(state)));
    expect(parsed.knights[CENTER_VERTEX]?.owner).toBe('p1');
  });
});

describe('Stadtmauer am Gebaeude', () => {
  it('fehlt in einer gespeicherten Partie und heisst dann: keine', () => {
    expect(BuildingSchema.parse({ owner: 'p1', kind: 'city' }).wall).toBe(false);
  });

  it('steht an der Stadt, die sie traegt, und nicht an der daneben', () => {
    const parsed = BuildingSchema.parse({ owner: 'p1', kind: 'city', wall: true });
    expect(parsed.wall).toBe(true);
  });
});
