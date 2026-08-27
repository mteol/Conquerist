// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { MAX_TRACK_LEVEL, TRACK_IDS, type TrackId } from '@conquerist/shared';
import { render, screen } from '../test/dom';
import { TRACK_ABBR } from '../game/labels';
import { TrackStrip } from './TrackStrip';
// Roher Dateiinhalt statt `node:fs`, wie in `AccountCorner.test.tsx`: das
// Client-Paket hält sich bewusst frei von Node-Typen.
import css from '../index.css?raw';

/*
 * Befund B (Aufgabe 11): die kompakte Leiste je Sitz stand mit `--track-color`
 * auf der Tiefsee - der Wert ist für den hellen Würfelkörper gemischt und
 * riss dort den Kontrast (Politik 1,25:1, Wissenschaft 1,34:1 gegen den
 * aktiven, olivfarben hinterlegten Sitz). jsdom rechnet kein Layout und
 * keinen Kontrast - was sich prüfen läßt, ist, daß die Leiste jetzt die
 * Tiefsee-Variante der Bereichsfarbe liest.
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
  it('zeigt fuenf Punkte je Bereich', () => {
    render(<TrackStrip player="p1" levels={levels({})} />);

    for (const track of TRACK_IDS) {
      for (let step = 1; step <= MAX_TRACK_LEVEL; step += 1) {
        expect(screen.getByTestId(`trackstrip-p1-${track}-${step}`)).toBeTruthy();
      }
    }
  });

  it('fuellt so viele Punkte, wie die Stufe verlangt - und keinen mehr', () => {
    render(<TrackStrip player="p1" levels={levels({ trade: 2, politics: 0, science: 5 })} />);

    for (let step = 1; step <= MAX_TRACK_LEVEL; step += 1) {
      const filled = step <= 2;
      expect(
        screen
          .getByTestId(`trackstrip-p1-trade-${step}`)
          .classList.contains('trackstrip__dot--filled'),
      ).toBe(filled);
      expect(
        screen
          .getByTestId(`trackstrip-p1-politics-${step}`)
          .classList.contains('trackstrip__dot--filled'),
      ).toBe(false);
      expect(
        screen
          .getByTestId(`trackstrip-p1-science-${step}`)
          .classList.contains('trackstrip__dot--filled'),
      ).toBe(true);
    }
  });

  it('traegt das Kuerzel je Bereich, nicht nur die Farbe (Designregel 7)', () => {
    render(<TrackStrip player="p1" levels={levels({})} />);

    const strip = screen.getByTestId('trackstrip-p1');
    for (const track of TRACK_IDS) {
      expect(strip.textContent).toContain(TRACK_ABBR[track]);
    }
  });
});

/** Liefert den Inhalt der ersten Regel `selector { ... }` ab `fromIndex`. */
function ruleBody(selector: string, fromIndex = 0): string {
  const needle = `${selector} {`;
  const start = css.indexOf(needle, fromIndex);
  if (start === -1) throw new Error(`Regel nicht gefunden: ${selector}`);
  const openBrace = start + needle.length - 1;
  let depth = 1;
  let i = openBrace + 1;
  while (depth > 0) {
    if (css[i] === '{') depth += 1;
    else if (css[i] === '}') depth -= 1;
    i += 1;
  }
  return css.slice(openBrace + 1, i - 1);
}

describe('Kompakte Leiste im CSS (index.css)', () => {
  it('färbt das Kürzel mit der Tiefsee-Variante der Bereichsfarbe', () => {
    expect(ruleBody('.trackstrip__abbr')).toMatch(/color:\s*var\(--track-color-on-sea\)/);
  });

  it('färbt den leeren Punkt mit derselben Tiefsee-Variante', () => {
    expect(ruleBody('.trackstrip__dot')).toMatch(/border:\s*1px solid var\(--track-color-on-sea\)/);
  });

  it('färbt den gefüllten Punkt mit derselben Tiefsee-Variante', () => {
    expect(ruleBody('.trackstrip__dot--filled')).toMatch(
      /background:\s*var\(--track-color-on-sea\)/,
    );
  });
});
