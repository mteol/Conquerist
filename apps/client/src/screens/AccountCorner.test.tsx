// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '../test/dom';
import { AccountCorner } from './AccountCorner';
// Roher Dateiinhalt statt `node:fs`: das Client-Paket haelt sich bewusst frei
// von Node-Typen (`types: []` in `tsconfig.json`), Vites `?raw`-Import
// braucht keine.
import css from '../index.css?raw';

const gast = { userId: 'u1', name: 'Gast', isGuest: true };
const konto = { userId: 'u2', name: 'Anna', isGuest: false, login: 'anna' };

describe('Konto-Ecke', () => {
  it('bietet dem Gast beide Wege an', () => {
    render(
      <AccountCorner identity={gast} onRegister={vi.fn()} onLogin={vi.fn()} onLogout={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: 'Konto anlegen' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Anmelden' })).toBeTruthy();
  });

  it('zeigt dem Angemeldeten seinen Namen und nur das Abmelden', () => {
    render(
      <AccountCorner identity={konto} onRegister={vi.fn()} onLogin={vi.fn()} onLogout={vi.fn()} />,
    );

    expect(screen.getByText('Anna')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Abmelden' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Anmelden' })).toBeNull();
  });

  it('haelt sich zurueck, solange niemand feststeht', () => {
    // Vor dem ersten `hello` waere jede Aussage geraten - und ein „Gast", der
    // eine Sekunde spaeter zu „Anna" wird, ist ein Flackern.
    const { container } = render(
      <AccountCorner identity={null} onRegister={vi.fn()} onLogin={vi.fn()} onLogout={vi.fn()} />,
    );

    expect(container.querySelector('.corner')).toBeNull();
  });
});

/*
 * jsdom rechnet kein Layout und wertet keine Media Queries aus - eine
 * gerenderte Breite oder ein tatsaechlicher Zeilenumbruch laesst sich hier
 * also nicht beobachten. Was sich pruefen laesst: dass die Regeln, die das
 * schmale Fenster bedienbar halten, tatsaechlich im CSS stehen.
 *
 * Ohne `flex-wrap` bricht `.corner` im schmalen Fenster nicht um, sondern
 * wird von `.menu`s `overflow: hidden` abgeschnitten - „Anmelden" waere dann
 * unklickbar. Und eine hoehere, umgebrochene Ecke braucht mehr Abstand vor
 * der Wortmarke, sonst verschiebt sich derselbe Fehler nur.
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

describe('Konto-Ecke im schmalen Fenster (index.css)', () => {
  it('bricht um statt abgeschnitten zu werden', () => {
    const corner = ruleBody('.corner');
    expect(corner).toMatch(/flex-wrap:\s*wrap/);
  });

  it('passt Ecke und Wortmarken-Abstand in derselben Media Query an', () => {
    const media = ruleBody('@media (max-width: 26rem)');

    // Beide Anpassungen stehen im selben Block - das ist die eigentliche
    // Forderung: eine hoehere Ecke ohne mehr Platz vor der Wortmarke waere
    // derselbe Fehler an anderer Stelle. Innerhalb der Media Query gibt es
    // keine weitere Verschachtelung, `[^}]*` reicht deshalb, um die
    // verschachtelten Regeln einzeln zu fassen.
    const narrowCornerMatch = /\.corner\s*\{([^}]*)\}/.exec(media);
    const narrowMenuInnerMatch = /\.menu__inner\s*\{([^}]*)\}/.exec(media);
    if (narrowCornerMatch === null) throw new Error('`.corner` fehlt in der Media Query');
    if (narrowMenuInnerMatch === null) throw new Error('`.menu__inner` fehlt in der Media Query');

    const narrowCorner = requiredGroup(narrowCornerMatch, 1);
    const narrowMenuInner = requiredGroup(narrowMenuInnerMatch, 1);

    // Die Ecke wird enger, nicht nur schmaler gefuehlt.
    expect(narrowCorner).toMatch(/gap:/);
    expect(narrowCorner).toMatch(/padding:/);
    expect(narrowCorner).toMatch(/font-size:/);

    // Der Abstand vor der Wortmarke waechst gegenueber der Grundregel -
    // eine umgebrochene, hoehere Ecke braucht mehr Luft, nicht dieselbe.
    const basePaddingTop = remValue(/padding-top:\s*([\d.]+)rem/, ruleBody('.menu__inner'));
    const narrowPaddingTop = remValue(/padding-top:\s*([\d.]+)rem/, narrowMenuInner);
    expect(narrowPaddingTop).toBeGreaterThan(basePaddingTop);
  });
});
