// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
  CITIES_RULES,
  CLASSIC_RULES,
  TRACK_IDS,
  type GameAction,
  type TrackId,
} from '@conquerist/shared';
import { render, screen, userEvent } from '../test/dom';
import { EMPTY_TARGETS, targetsFrom } from '../game/targets';
import { TrackPanel } from './TrackPanel';
// Roher Dateiinhalt statt `node:fs`, wie in `AccountCorner.test.tsx`: das
// Client-Paket haelt sich bewusst frei von Node-Typen.
import css from '../index.css?raw';

const player = (levels: Partial<Record<TrackId, number>>) => ({
  improvements: levels,
});

describe('TrackPanel', () => {
  it('zeigt drei Leitern zu je fuenf Stufen', () => {
    render(
      <TrackPanel
        targets={EMPTY_TARGETS}
        barbarianTrack={CITIES_RULES.barbarianTrack}
        player={player({})}
        onImprove={vi.fn()}
      />,
    );

    for (const track of TRACK_IDS) {
      for (let step = 1; step <= 5; step += 1) {
        expect(screen.getByTestId(`track-${track}-${step}`)).toBeTruthy();
      }
    }
  });

  it('markiert gebaute Stufen mit data-built="true", die uebrigen mit "false"', () => {
    render(
      <TrackPanel
        targets={EMPTY_TARGETS}
        barbarianTrack={CITIES_RULES.barbarianTrack}
        player={player({ trade: 2 })}
        onImprove={vi.fn()}
      />,
    );

    expect(screen.getByTestId('track-trade-1').getAttribute('data-built')).toBe('true');
    expect(screen.getByTestId('track-trade-2').getAttribute('data-built')).toBe('true');
    expect(screen.getByTestId('track-trade-3').getAttribute('data-built')).toBe('false');
    expect(screen.getByTestId('track-trade-4').getAttribute('data-built')).toBe('false');
    expect(screen.getByTestId('track-trade-5').getAttribute('data-built')).toBe('false');
  });

  it('macht nur die naechste Stufe zu einem Knopf, und der ist gesperrt, wenn die Klickkarte nichts anbietet', () => {
    render(
      <TrackPanel
        targets={EMPTY_TARGETS}
        barbarianTrack={CITIES_RULES.barbarianTrack}
        player={player({ trade: 2 })}
        onImprove={vi.fn()}
      />,
    );

    expect(screen.getByTestId('track-trade-3').tagName).toBe('BUTTON');
    expect(screen.getByTestId('track-trade-1').tagName).toBe('DIV');
    expect(screen.getByTestId('track-trade-2').tagName).toBe('DIV');
    expect(screen.getByTestId('track-trade-4').tagName).toBe('DIV');
    expect(screen.getByTestId('track-trade-5').tagName).toBe('DIV');
    expect((screen.getByTestId('track-trade-3') as HTMLButtonElement).disabled).toBe(true);
  });

  it('oeffnet den Knopf der naechsten Stufe, sobald die Klickkarte sie anbietet', () => {
    const targets = targetsFrom([
      { type: 'improveCity', player: 'p1', track: 'trade' },
    ] as GameAction[]);

    render(
      <TrackPanel
        targets={targets}
        barbarianTrack={CITIES_RULES.barbarianTrack}
        player={player({ trade: 2 })}
        onImprove={vi.fn()}
      />,
    );

    expect((screen.getByTestId('track-trade-3') as HTMLButtonElement).disabled).toBe(false);
  });

  it('traegt den Preis im title - "Gilde: 3 Tuch"', () => {
    const targets = targetsFrom([
      { type: 'improveCity', player: 'p1', track: 'trade' },
    ] as GameAction[]);

    render(
      <TrackPanel
        targets={targets}
        barbarianTrack={CITIES_RULES.barbarianTrack}
        player={player({ trade: 2 })}
        onImprove={vi.fn()}
      />,
    );

    expect(screen.getByTestId('track-trade-3').getAttribute('title')).toBe('Gilde: 3 Tuch');
  });

  it('traegt an jeder Stufe ihre Schwelle als Ziffer - Stufe 1 zeigt 2, Stufe 5 zeigt 6', () => {
    const { container } = render(
      <TrackPanel
        targets={EMPTY_TARGETS}
        barbarianTrack={CITIES_RULES.barbarianTrack}
        player={player({})}
        onImprove={vi.fn()}
      />,
    );

    const first = container.querySelector('[data-testid="track-trade-1"] .tracks__threshold path');
    const last = container.querySelector('[data-testid="track-trade-5"] .tracks__threshold path');

    expect(first?.getAttribute('data-digit')).toBe('2');
    expect(last?.getAttribute('data-digit')).toBe('6');
  });

  it('erscheint nicht, wo das Regelwerk keinen Stadtausbau kennt', () => {
    const { container } = render(
      <TrackPanel
        targets={EMPTY_TARGETS}
        barbarianTrack={CLASSIC_RULES.barbarianTrack}
        player={player({})}
        onImprove={vi.fn()}
      />,
    );

    expect(container.querySelector('.tracks')).toBeNull();
  });

  it('meldet den Bereich nach oben, wenn die naechste Stufe angeklickt wird', async () => {
    const onImprove = vi.fn();
    const targets = targetsFrom([
      { type: 'improveCity', player: 'p1', track: 'trade' },
    ] as GameAction[]);

    render(
      <TrackPanel
        targets={targets}
        barbarianTrack={CITIES_RULES.barbarianTrack}
        player={player({ trade: 2 })}
        onImprove={onImprove}
      />,
    );

    await userEvent.click(screen.getByTestId('track-trade-3'));
    expect(onImprove).toHaveBeenCalledWith('trade');
  });
});

/*
 * jsdom rechnet kein Layout aus - eine gerenderte Schriftgroesse oder ein
 * tatsaechlicher Kontrast lassen sich hier nicht beobachten (Befund A und C
 * aus Aufgabe 11 wurden im echten Browser gemessen). Was sich pruefen laesst:
 * dass die Regeln, die die Befunde beheben, tatsaechlich im CSS stehen.
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

describe('Tableau im CSS (index.css)', () => {
  it('Befund A: die naechste Stufe erbt die Schriftgroesse, statt die Vorgabe des Nutzeragenten zu behalten', () => {
    expect(ruleBody('.tracks__step--next')).toMatch(/font:\s*inherit/);
  });

  it('Befund C: das Kopfwort der Leiter liest die Tiefsee-Variante der Bereichsfarbe', () => {
    expect(ruleBody('.tracks__name')).toMatch(/color:\s*var\(--track-color-on-sea\)/);
  });

  it('Befund D: die gebaute Stufe waehlt die Wortfarbe je Bereich, nicht pauschal die helle Tinte', () => {
    expect(ruleBody('.tracks__step--built .tracks__word')).toMatch(
      /color:\s*var\(--track-word-color\)/,
    );
  });

  it('Befund D: die ungebaute Stufe traegt dunkle Tinte auf ihrem Pergamentkoerper', () => {
    // `.tracks__word {` steht als Teilstring auch in
    // `.tracks__step--built .tracks__word {` weiter oben im Blatt - erst
    // hinter dessen gesamter Kopfzeile weitersuchen, sonst findet `ruleBody`
    // dieselbe falsche Regel wieder.
    const builtRuleHead = '.tracks__step--built .tracks__word {';
    const afterBuiltRule = css.indexOf(builtRuleHead) + builtRuleHead.length;
    expect(ruleBody('.tracks__word', afterBuiltRule)).toMatch(/color:\s*var\(--ink\)/);
  });
});
