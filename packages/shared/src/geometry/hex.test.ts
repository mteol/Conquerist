import { describe, expect, it } from 'vitest';

import { HEX_DIRECTIONS, HEX_DIRECTION_COUNT } from './directions.js';
import {
  hexAdd,
  hexDistance,
  hexEquals,
  hexFromId,
  hexNeighbor,
  hexNeighbors,
  hexRing,
  hexRowLayout,
  hexScale,
  hexSpiral,
  hexToCube,
  hexToId,
  type Hex,
} from './hex.js';

const ORIGIN: Hex = { q: 0, r: 0 };

/** Vergleicht Hex-Mengen ohne Rueckgriff auf die Reihenfolge. */
function idSet(hexes: readonly Hex[]): Set<string> {
  return new Set(hexes.map(hexToId));
}

describe('HEX_DIRECTIONS', () => {
  it('enthaelt sechs Richtungen', () => {
    expect(HEX_DIRECTIONS).toHaveLength(6);
    expect(HEX_DIRECTION_COUNT).toBe(6);
  });

  it('enthaelt zu jeder Richtung die Gegenrichtung', () => {
    for (const direction of HEX_DIRECTIONS) {
      const opposite = { q: -direction.q, r: -direction.r };
      expect(HEX_DIRECTIONS.some((candidate) => hexEquals(candidate, opposite))).toBe(true);
    }
  });

  it('enthaelt keine Richtung doppelt', () => {
    expect(idSet(HEX_DIRECTIONS).size).toBe(6);
  });

  it('beschreibt lauter direkte Nachbarn des Ursprungs', () => {
    for (const direction of HEX_DIRECTIONS) {
      expect(hexDistance(ORIGIN, direction)).toBe(1);
    }
  });

  it('laeuft im Kreis: aufeinanderfolgende Richtungen sind selbst benachbart', () => {
    for (let i = 0; i < HEX_DIRECTION_COUNT; i += 1) {
      const current = HEX_DIRECTIONS[i]!;
      const next = HEX_DIRECTIONS[(i + 1) % HEX_DIRECTION_COUNT]!;
      expect(hexDistance(current, next)).toBe(1);
    }
  });
});

describe('hexToCube', () => {
  it('erfuellt die Cube-Invariante x + y + z = 0', () => {
    for (const hex of hexSpiral(ORIGIN, 3)) {
      const cube = hexToCube(hex);
      expect(cube.x + cube.y + cube.z).toBe(0);
    }
  });
});

describe('hexNeighbor', () => {
  it('liefert fuer jede Richtung ein Feld in Distanz 1', () => {
    const hex: Hex = { q: 2, r: -3 };
    for (let direction = 0; direction < HEX_DIRECTION_COUNT; direction += 1) {
      expect(hexDistance(hex, hexNeighbor(hex, direction))).toBe(1);
    }
  });

  it('ist umkehrbar: hin und in die Gegenrichtung zurueck', () => {
    const hex: Hex = { q: -1, r: 4 };
    for (let direction = 0; direction < HEX_DIRECTION_COUNT; direction += 1) {
      const there = hexNeighbor(hex, direction);
      const back = hexNeighbor(there, (direction + 3) % HEX_DIRECTION_COUNT);
      expect(hexEquals(back, hex)).toBe(true);
    }
  });

  it('rechnet Richtungen zyklisch, damit direction + 1 nie ueberlaeuft', () => {
    const hex: Hex = { q: 0, r: 0 };
    expect(hexNeighbor(hex, 6)).toEqual(hexNeighbor(hex, 0));
    expect(hexNeighbor(hex, -1)).toEqual(hexNeighbor(hex, 5));
  });

  it('liefert sechs verschiedene Nachbarn', () => {
    expect(idSet(hexNeighbors({ q: 5, r: 5 })).size).toBe(6);
  });
});

describe('hexDistance', () => {
  it('ist null zum Feld selbst', () => {
    expect(hexDistance({ q: 3, r: -2 }, { q: 3, r: -2 })).toBe(0);
  });

  it('ist symmetrisch', () => {
    const a: Hex = { q: 1, r: 2 };
    const b: Hex = { q: -3, r: 4 };
    expect(hexDistance(a, b)).toBe(hexDistance(b, a));
  });

  it('zaehlt Schritte entlang einer Geraden', () => {
    let hex = ORIGIN;
    for (let step = 1; step <= 5; step += 1) {
      hex = hexNeighbor(hex, 0);
      expect(hexDistance(ORIGIN, hex)).toBe(step);
    }
  });

  it('erfuellt die Dreiecksungleichung', () => {
    const a: Hex = { q: 0, r: 0 };
    const b: Hex = { q: 3, r: -1 };
    const c: Hex = { q: -2, r: 4 };
    expect(hexDistance(a, c)).toBeLessThanOrEqual(hexDistance(a, b) + hexDistance(b, c));
  });
});

describe('hexAdd / hexScale', () => {
  it('addiert komponentenweise', () => {
    expect(hexAdd({ q: 1, r: 2 }, { q: -3, r: 5 })).toEqual({ q: -2, r: 7 });
  });

  it('skaliert komponentenweise', () => {
    expect(hexScale({ q: 1, r: -2 }, 3)).toEqual({ q: 3, r: -6 });
  });
});

describe('hexRing', () => {
  it('liefert fuer Radius 0 nur den Mittelpunkt', () => {
    expect(hexRing(ORIGIN, 0)).toEqual([ORIGIN]);
  });

  it('liefert 6 * radius Felder', () => {
    for (const radius of [1, 2, 3, 7]) {
      expect(hexRing(ORIGIN, radius)).toHaveLength(6 * radius);
    }
  });

  it('enthaelt ausschliesslich Felder im angegebenen Abstand', () => {
    const center: Hex = { q: -2, r: 3 };
    for (const hex of hexRing(center, 4)) {
      expect(hexDistance(center, hex)).toBe(4);
    }
  });

  it('enthaelt kein Feld doppelt', () => {
    expect(idSet(hexRing(ORIGIN, 5)).size).toBe(30);
  });

  it('ist geschlossen: jedes Feld grenzt an das naechste', () => {
    const ring = hexRing(ORIGIN, 3);
    for (let i = 0; i < ring.length; i += 1) {
      expect(hexDistance(ring[i]!, ring[(i + 1) % ring.length]!)).toBe(1);
    }
  });

  it('lehnt einen negativen Radius ab', () => {
    expect(() => hexRing(ORIGIN, -1)).toThrow(RangeError);
  });
});

describe('hexSpiral', () => {
  it('liefert die zentrierten Sechseckszahlen', () => {
    expect(hexSpiral(ORIGIN, 0)).toHaveLength(1);
    expect(hexSpiral(ORIGIN, 1)).toHaveLength(7);
    expect(hexSpiral(ORIGIN, 2)).toHaveLength(19);
    expect(hexSpiral(ORIGIN, 3)).toHaveLength(37);
  });

  it('beginnt in der Mitte und laeuft nach aussen', () => {
    const spiral = hexSpiral(ORIGIN, 3);
    expect(spiral[0]).toEqual(ORIGIN);

    let previousDistance = 0;
    for (const hex of spiral) {
      const distance = hexDistance(ORIGIN, hex);
      expect(distance).toBeGreaterThanOrEqual(previousDistance);
      previousDistance = distance;
    }
  });

  it('enthaelt kein Feld doppelt', () => {
    expect(idSet(hexSpiral(ORIGIN, 4)).size).toBe(61);
  });

  it('ist um einen anderen Mittelpunkt nur verschoben', () => {
    const center: Hex = { q: 4, r: -7 };
    const shifted = hexSpiral(center, 2).map((hex) => hexAdd(hex, hexScale(center, -1)));
    expect(idSet(shifted)).toEqual(idSet(hexSpiral(ORIGIN, 2)));
  });
});

describe('hexToId / hexFromId', () => {
  it('ueberlebt den Roundtrip', () => {
    for (const hex of hexSpiral(ORIGIN, 3)) {
      expect(hexFromId(hexToId(hex))).toEqual(hex);
    }
  });

  it('schreibt negative Koordinaten lesbar', () => {
    expect(hexToId({ q: -1, r: 2 })).toBe('-1,2');
  });

  it('bildet verschiedene Felder auf verschiedene Ids ab', () => {
    expect(idSet(hexSpiral(ORIGIN, 4)).size).toBe(61);
  });

  it('lehnt kaputte Ids ab', () => {
    for (const broken of ['', '1', '1,2,3', 'a,2', '1,', '1.5,2', ' 1,2']) {
      expect(() => hexFromId(broken)).toThrow();
    }
  });
});

describe('hexRowLayout', () => {
  it('erzeugt fuer 3-4-5-4-3 genau das Sechseck mit Radius 2', () => {
    // Zwei voneinander unabhaengige Konstruktionen desselben Bretts. Wenn eine
    // von beiden falsch ist, koennen sie nicht uebereinstimmen.
    expect(idSet(hexRowLayout([3, 4, 5, 4, 3]))).toEqual(idSet(hexSpiral(ORIGIN, 2)));
  });

  it('erzeugt fuer 3-4-5-6-5-4-3 dreissig zusammenhaengende Felder', () => {
    const hexes = hexRowLayout([3, 4, 5, 6, 5, 4, 3]);

    expect(hexes).toHaveLength(30);
    expect(idSet(hexes).size).toBe(30);

    // Zusammenhaengend: jedes Feld hat mindestens einen Nachbarn im Brett.
    const present = idSet(hexes);
    for (const hex of hexes) {
      const touching = hexNeighbors(hex).filter((neighbor) => present.has(hexToId(neighbor)));
      expect(touching.length).toBeGreaterThan(0);
    }
  });

  it('lehnt leere Layouts und Reihen ohne Felder ab', () => {
    expect(() => hexRowLayout([])).toThrow(RangeError);
    expect(() => hexRowLayout([3, 0, 3])).toThrow(RangeError);
    expect(() => hexRowLayout([3, 2.5])).toThrow(RangeError);
  });
});
