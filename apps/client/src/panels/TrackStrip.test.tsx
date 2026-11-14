// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { MAX_TRACK_LEVEL, TRACK_IDS, type TrackId } from '@conquerist/shared';
import { render, screen } from '../test/dom';
import { TRACK_COLORS_ON_SEA, TRACK_NAMES } from '../game/labels';
import { TrackStrip } from './TrackStrip';

/*
 * Befund B (Aufgabe 11): die Bereichsfarbe muss auf der Tiefsee tragen. Die
 * Leiste liest deshalb die `-on-sea`-Variante (`--scale-ink` am Maßstab); den
 * Kontrast selbst rechnet jsdom nicht, das bleibt der Browser-Durchlauf.
 */

/*
 * I4 der Abschlußreview: diese Datei prüfte bislang ausschließlich die drei
 * CSS-Regeln unten und importierte `TrackStrip` nirgends - die Komponente
 * selbst stand ohne einen einzigen Rendertest da, und die Testkennungen
 * `trackstrip-${player}-${track}-${step}` waren Haken ohne Leine. Genau
 * deshalb ist I3 (die Leiste ohne `isYou`-Filter) durchgerutscht: kein Test
 * hat je behauptet, was die Leiste zeigen soll. Die folgenden Tests rendern
 * die Komponente wirklich und benutzen ihre Testkennungen.
 */
const levels = (improvements: Partial<Record<TrackId, number>>) => ({ improvements });

describe('TrackStrip (Rendering)', () => {
  it('zeigt fünf Punkte je Bereich', () => {
    render(<TrackStrip player="p1" levels={levels({})} />);

    for (const track of TRACK_IDS) {
      for (let step = 1; step <= MAX_TRACK_LEVEL; step += 1) {
        expect(screen.getByTestId(`trackstrip-p1-${track}-${step}`)).toBeTruthy();
      }
    }
  });

  it('füllt so viele Punkte, wie die Stufe verlangt - und keinen mehr', () => {
    render(<TrackStrip player="p1" levels={levels({ trade: 2, politics: 0, science: 5 })} />);

    for (let step = 1; step <= MAX_TRACK_LEVEL; step += 1) {
      const filled = step <= 2;
      expect(screen.getByTestId(`trackstrip-p1-trade-${step}`).classList.contains('is-on')).toBe(
        filled,
      );
      expect(screen.getByTestId(`trackstrip-p1-politics-${step}`).classList.contains('is-on')).toBe(
        false,
      );
      expect(screen.getByTestId(`trackstrip-p1-science-${step}`).classList.contains('is-on')).toBe(
        true,
      );
    }
  });

  it('nennt den Bereich beim Namen, nicht nur in der Farbe (Designregel 7)', () => {
    render(<TrackStrip player="p1" levels={levels({ trade: 2 })} />);

    const strip = screen.getByTestId('trackstrip-p1');
    for (const track of TRACK_IDS) {
      expect(strip.textContent).toContain(TRACK_NAMES[track]);
    }
    // Und beim Darüberfahren: der Name als Titel der Auskunft, die Stufe als Text.
    const row = strip.querySelector('[data-hint-title="Handel"]');
    expect(row?.getAttribute('data-hint')).toBe(`Stufe 2 von ${MAX_TRACK_LEVEL}`);
  });

  it('färbt den Maßstab mit der Tiefsee-Variante der Bereichsfarbe', () => {
    render(<TrackStrip player="p1" levels={levels({})} />);

    const rows = screen.getByTestId('trackstrip-p1').querySelectorAll<HTMLElement>('.scalebar');
    expect([...rows].map((row) => row.style.getPropertyValue('--scale-ink'))).toEqual(
      TRACK_IDS.map((track) => TRACK_COLORS_ON_SEA[track]),
    );
  });
});
