// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
  CARD_IDS,
  CITIES_RULES,
  CLASSIC_RULES,
  type CardAmounts,
  TRACK_IDS,
  type GameAction,
  type TrackId,
} from '@conquerist/shared';
import { render, screen, userEvent } from '../test/dom';
import { EMPTY_TARGETS, targetsFrom } from '../game/targets';
import { TrackPanel } from './TrackPanel';
// Roher Dateiinhalt statt `node:fs`, wie in `AccountCorner.test.tsx`: das
// Client-Paket hält sich bewusst frei von Node-Typen.
import { stylesheet as css } from '../test/stylesheet';

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

  it('schreibt die Bereiche aus und sagt am gesperrten Knopf, was fehlt', () => {
    render(
      <TrackPanel
        targets={EMPTY_TARGETS}
        barbarianTrack={CITIES_RULES.barbarianTrack}
        player={player({ trade: 2 })}
        hand={Object.fromEntries(CARD_IDS.map((id) => [id, id === 'cloth' ? 1 : 0])) as CardAmounts}
        onImprove={vi.fn()}
      />,
    );

    expect(screen.getByText('Handel')).toBeTruthy();
    expect(screen.getByText('Politik')).toBeTruthy();
    expect(screen.getByText('Wissenschaft')).toBeTruthy();
    // Stufe 3 kostet 3 Tuch, die Hand hat eins: es fehlen zwei.
    expect(screen.getByTestId('track-trade-3').getAttribute('data-hint')).toContain(
      'Dir fehlt 2 Tuch.',
    );
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
 * jsdom rechnet kein Layout aus - eine gerenderte Schriftgröße oder ein
 * tatsächlicher Kontrast lassen sich hier nicht beobachten (Befund A und C
 * aus Aufgabe 11 wurden im echten Browser gemessen). Was sich prüfen läßt:
 * daß die Regeln, die die Befunde beheben, tatsächlich im CSS stehen.
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
  it('Befund A: die nächste Stufe erbt die Schriftgröße, statt die Vorgabe des Nutzeragenten zu behalten', () => {
    expect(ruleBody('.tracks__step--next')).toMatch(/font:\s*inherit/);
  });

  it('Befund C: das Kopfwort der Leiter liest die Tiefsee-Variante der Bereichsfarbe', () => {
    expect(ruleBody('.tracks__name')).toMatch(/color:\s*var\(--track-color-on-sea\)/);
  });

  it('Befund D: die gebaute Stufe wählt die Wortfarbe je Bereich, nicht pauschal die helle Tinte', () => {
    expect(ruleBody('.tracks__step--built .tracks__word')).toMatch(
      /color:\s*var\(--track-word-color\)/,
    );
  });

  it('Befund D: die ungebaute Stufe liegt auf der See und liest die helle Tinte, nicht die dunkle', () => {
    // Seit dem Umbau steht die Sprosse, die noch nicht gebaut ist, als bloßer
    // Umriss auf der Tiefsee (nicht mehr auf eigenem Pergament): dunkle Tinte
    // wäre dort unsichtbar. `.tracks__word` ist die Grundregel, die erste ihres
    // Namens im Blatt - die Zustandsregeln davor tragen ein Präfix.
    expect(ruleBody('.tracks__word')).toMatch(/color:\s*var\(--on-sea-muted\)/);
  });
});
