// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
// Roher Dateiinhalt statt `node:fs` - siehe AccountCorner.test.tsx: Vites
// `?raw`-Import braucht keine Node-Typen, das Client-Paket haelt `types: []`.
import css from '../index.css?raw';

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

/** Erzwingt eine gefundene Fanggruppe - `noUncheckedIndexedAccess` laesst `match[n]` sonst `undefined` sein. */
function requiredGroup(match: RegExpExecArray, index: number): string {
  const value = match[index];
  if (value === undefined) throw new Error(`Fanggruppe ${index} fehlt in „${match[0]}"`);
  return value;
}

function remValue(declaration: RegExp, body: string): number {
  const match = declaration.exec(body);
  if (match === null) throw new Error(`Eigenschaft nicht gefunden: ${declaration.source}`);
  return Number(requiredGroup(match, 1));
}

/*
 * jsdom rechnet kein Layout - eine tatsaechlich gerenderte Groesse laesst sich
 * hier nicht messen. Was sich pruefen laesst: dass die Regel selbst eine
 * Trefferflaeche von mindestens 44 px vorschreibt (Rahmenbedingung "Trefferflaechen
 * mindestens 44 px"), unabhaengig davon, wie gross das gezeichnete Kreuz aussieht.
 */
describe('Schliesskreuz: Trefferflaeche in index.css', () => {
  it('bleibt am sichtbaren Kreis bei 2,25rem (36px) - der Fund war zu klein, nicht zu gross', () => {
    const closeButton = ruleBody('.modal__close');

    const width = remValue(/width:\s*([\d.]+)rem/, closeButton);
    const height = remValue(/height:\s*([\d.]+)rem/, closeButton);

    expect(width).toBe(2.25);
    expect(height).toBe(2.25);
  });

  it('erweitert die Trefferflaeche unsichtbar auf mindestens 44px, ohne den Kreis zu vergroessern', () => {
    // `.modal__close::before` ist eine unsichtbare, groessere Flaeche ueber
    // demselben Knopf - der Kreis (Hintergrund, Radius) bleibt unveraendert,
    // nur der Bereich, der Klicks entgegennimmt, waechst.
    const before = ruleBody('.modal__close::before');

    expect(before).toMatch(/content:\s*['"]{2}/);
    expect(before).toMatch(/position:\s*absolute/);

    const inset = remValue(/inset:\s*(-?[\d.]+)rem/, before);
    const visibleSizeRem = 2.25;
    const hitAreaPx = (visibleSizeRem + 2 * Math.abs(inset)) * 16;

    expect(inset).toBeLessThan(0);
    expect(hitAreaPx).toBeGreaterThanOrEqual(44);
  });
});
