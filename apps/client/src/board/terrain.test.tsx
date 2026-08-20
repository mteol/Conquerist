// @vitest-environment jsdom
import type { JSX } from 'react';
import { describe, expect, it } from 'vitest';
import { TERRAIN_LABELS, type TerrainId } from '@conquerist/shared';
import { render } from '../test/dom';
import { TILES, TerrainPatterns, patternId, terrainFill } from './terrain';

/**
 * Die Textur wird **nachgerechnet**, nicht angesehen.
 *
 * Bei einer gekachelten Flaeche ist das Wichtigste unsichtbar, solange es
 * stimmt, und springt sofort ins Auge, sobald es nicht stimmt: die Naht. Eine
 * Linie, die bei x = 0 auf einer anderen Hoehe anfaengt als sie bei x = Breite
 * endet, macht aus jeder Kachelgrenze einen Knick - und aus einer Textur ein
 * Gitter. Am Bildschirm sieht man das erst, wenn man weiss, wonach man sucht;
 * ausgerechnet ist es eindeutig.
 *
 * Dieselbe Datei hielt vorher die Freistellung um den Zahlenchip fest. Die ist
 * mit dem Motivband weggefallen: der Chip ist deckend, und eine Textur, die
 * darunter durchlaeuft, verdeckt nichts.
 */

const TERRAINS = Object.keys(TERRAIN_LABELS) as TerrainId[];

describe('TerrainPatterns', () => {
  it('legt fuer jedes Gelaende eine Kachel an', () => {
    const { container } = render(<Probe />);

    for (const terrain of TERRAINS) {
      const tile = container.querySelector(`#${patternId(terrain)}`);

      expect(tile, `${terrain} hat keine Kachel`).not.toBeNull();
      expect(tile!.querySelectorAll('path').length).toBeGreaterThan(0);
      expect(terrainFill(terrain)).toBe(`url(#${patternId(terrain)})`);
    }
  });

  /**
   * Die Textur haengt am Brett, nicht am Feld.
   *
   * `objectBoundingBox` waere die Voreinstellung und genau falsch: dann rechnet
   * jedes Feld die Kachel auf seine eigene Flaeche, und zwei benachbarte
   * Waldfelder zeigen zwei Kacheln statt eines Waldes. Mit `userSpaceOnUse`
   * laeuft die Textur ueber die Feldgrenze durch.
   */
  it('verankert jede Kachel am Brett und nicht am einzelnen Feld', () => {
    const { container } = render(<Probe />);

    for (const terrain of TERRAINS) {
      const tile = container.querySelector(`#${patternId(terrain)}`)!;

      expect(tile.getAttribute('patternUnits'), terrain).toBe('userSpaceOnUse');
      expect(Number(tile.getAttribute('width'))).toBe(TILES[terrain].w);
      expect(Number(tile.getAttribute('height'))).toBe(TILES[terrain].h);
    }
  });

  /**
   * Die Naht: was den einen Rand beruehrt, beruehrt den anderen genauso.
   *
   * Geprueft werden nur die Pfade, die die Kachel wirklich durchqueren - wer
   * bei x = 0 anfaengt, muss bei x = Breite auf derselben Hoehe herauskommen.
   * Ein Bueschel oder eine Tanne mitten in der Kachel geht das nichts an.
   */
  it('schliesst jede Kachel waagerecht ohne Knick', () => {
    const { container } = render(<Probe />);
    let geprueft = 0;

    for (const terrain of TERRAINS) {
      const width = TILES[terrain].w;

      for (const path of container.querySelectorAll(`#${patternId(terrain)} path`)) {
        const points = pointsOf(path.getAttribute('d') ?? '');
        const first = points[0]!;
        const last = points[points.length - 1]!;

        if (!near(first.x, 0) || !near(last.x, width)) continue;

        expect(
          last.y,
          `${terrain}: die Linie faengt bei y ${first.y} an und endet bei y ${last.y} - das gibt an jeder Kachelgrenze einen Knick`,
        ).toBeCloseTo(first.y, 5);
        geprueft += 1;
      }
    }

    // Ein Test, der nichts gezaehlt hat, hat nichts geprueft.
    expect(geprueft).toBeGreaterThan(0);
  });

  /**
   * Was aus der Kachel ragt, wird abgeschnitten - und ein abgeschnittener Baum
   * sieht aus wie ein Zeichenfehler.
   *
   * Kontrollpunkte duerfen draussen liegen (die Duenenwelle braucht das, sonst
   * bekaeme sie ihren Ausschlag nicht), gezeichnete Punkte nicht. Geprueft
   * werden deshalb die **Stuetzpunkte** der Pfade, nicht jede Zahl im `d`.
   */
  it('haelt jede Marke innerhalb ihrer Kachel', () => {
    const { container } = render(<Probe />);

    for (const terrain of TERRAINS) {
      const { w, h } = TILES[terrain];

      for (const path of container.querySelectorAll(`#${patternId(terrain)} path`)) {
        for (const { x, y } of pointsOf(path.getAttribute('d') ?? '')) {
          const drin = x >= -1e-9 && x <= w + 1e-9 && y >= -1e-9 && y <= h + 1e-9;

          expect(drin, `${terrain}: (${x}, ${y}) liegt ausserhalb der Kachel ${w} x ${h}`).toBe(
            true,
          );
        }
      }
    }
  });
});

function Probe(): JSX.Element {
  return (
    <svg viewBox="0 0 1 1">
      <defs>
        <TerrainPatterns />
      </defs>
    </svg>
  );
}

interface Sample {
  readonly x: number;
  readonly y: number;
}

/**
 * Die Stuetzpunkte eines Pfades - ohne die Kontrollpunkte.
 *
 * `M` und `L` tragen je einen Punkt, `Q` deren zwei, von denen nur der zweite
 * auf der Kurve liegt. Die Pfade hier benutzen nur diese drei Befehle plus `Z`,
 * alle mit absoluten Koordinaten; alles andere waere ein stiller Fehler und
 * faellt deshalb auf.
 */
function pointsOf(d: string): readonly Sample[] {
  const out: Sample[] = [];
  const tokens = d.trim().split(/[\s,]+/);
  let index = 0;

  while (index < tokens.length) {
    const command = tokens[index++]!;

    if (command === 'Z' || command === 'z') continue;

    expect(['M', 'L', 'Q'], `unerwarteter Pfadbefehl "${command}" in "${d}"`).toContain(command);

    // Bei `Q` sind die ersten zwei Zahlen der Kontrollpunkt: ueberspringen.
    if (command === 'Q') index += 2;

    const x = Number(tokens[index++]);
    const y = Number(tokens[index++]);

    expect(Number.isFinite(x) && Number.isFinite(y), `kaputte Koordinate in "${d}"`).toBe(true);
    out.push({ x, y });
  }

  return out;
}

function near(value: number, target: number): boolean {
  return Math.abs(value - target) < 1e-9;
}
