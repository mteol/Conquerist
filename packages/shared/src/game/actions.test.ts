import { describe, expect, it } from 'vitest';

import {
  GAME_ACTION_TYPES,
  GameActionSchema,
  GameActionTypeSchema,
  isSystemAction,
  stampAction,
} from './actions.js';
import { hand } from './fixtures.js';

describe('stampAction', () => {
  it('ueberschreibt das mitgeschickte at', () => {
    const stamped = stampAction(
      {
        type: 'offerTrade',
        player: 'p1',
        give: hand({ lumber: 1 }),
        want: hand({ ore: 1 }),
        at: 5,
      },
      1_000,
    );

    expect(stamped).toMatchObject({ at: 1_000 });
  });

  it('stempelt auch das Gegenangebot - es setzt die Frist neu', () => {
    const stamped = stampAction(
      {
        type: 'counterTrade',
        player: 'p2',
        give: hand({ ore: 1 }),
        want: hand({ lumber: 1 }),
        at: 0,
      },
      2_000,
    );

    expect(stamped).toMatchObject({ at: 2_000 });
  });

  it('laesst Aktionen ohne Zeitbezug unveraendert - dieselbe Instanz', () => {
    const action = { type: 'endTurn', player: 'p1' } as const;

    expect(stampAction(action, 1_000)).toBe(action);
  });
});

describe('isSystemAction', () => {
  it('erkennt genau die drei Aktionen, die kein Spieler schickt', () => {
    expect(isSystemAction({ type: 'timeout', player: 'p1', at: 1 })).toBe(true);
    expect(isSystemAction({ type: 'dropFromTrade', player: 'p1' })).toBe(true);
    expect(isSystemAction({ type: 'rejoinTrade', player: 'p1' })).toBe(true);
  });

  it('laesst gewoehnliche Zuege durch', () => {
    expect(isSystemAction({ type: 'endTurn', player: 'p1' })).toBe(false);
    expect(isSystemAction({ type: 'acceptTrade', player: 'p1', partner: 'p2' })).toBe(false);
  });
});

describe('GameActionTypeSchema', () => {
  it('zaehlt genau die Zweige der Union auf', () => {
    // Die Union kennt ihre Zweige zur Laufzeit: jede Option ist ein ZodObject
    // mit einem Literal als `type`. Damit ist die Liste pruefbar und nicht nur
    // abgeschrieben - ein vergessener Zugtyp faellt hier auf.
    const fromUnion = GameActionSchema.options.map((option) => option.shape.type.value);

    expect([...GAME_ACTION_TYPES].sort()).toEqual([...fromUnion].sort());
  });

  it('nimmt einen bekannten Typ an und einen erfundenen nicht', () => {
    expect(GameActionTypeSchema.safeParse('buildCity').success).toBe(true);
    expect(GameActionTypeSchema.safeParse('buildCastle').success).toBe(false);
  });
});
