// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
// Roher Dateiinhalt statt `node:fs`, wie in `AccountCorner.test.tsx`: das
// Client-Paket haelt sich bewusst frei von Node-Typen.
import css from '../index.css?raw';

/*
 * Befund B (Aufgabe 11): die kompakte Leiste je Sitz stand mit `--track-color`
 * auf der Tiefsee - der Wert ist fuer den hellen Wuerfelkoerper gemischt und
 * riss dort den Kontrast (Politik 1,25:1, Wissenschaft 1,34:1 gegen den
 * aktiven, olivfarben hinterlegten Sitz). jsdom rechnet kein Layout und
 * keinen Kontrast - was sich pruefen laesst, ist, dass die Leiste jetzt die
 * Tiefsee-Variante der Bereichsfarbe liest.
 */

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
  it('faerbt das Kuerzel mit der Tiefsee-Variante der Bereichsfarbe', () => {
    expect(ruleBody('.trackstrip__abbr')).toMatch(/color:\s*var\(--track-color-on-sea\)/);
  });

  it('faerbt den leeren Punkt mit derselben Tiefsee-Variante', () => {
    expect(ruleBody('.trackstrip__dot')).toMatch(/border:\s*1px solid var\(--track-color-on-sea\)/);
  });

  it('faerbt den gefuellten Punkt mit derselben Tiefsee-Variante', () => {
    expect(ruleBody('.trackstrip__dot--filled')).toMatch(
      /background:\s*var\(--track-color-on-sea\)/,
    );
  });
});
