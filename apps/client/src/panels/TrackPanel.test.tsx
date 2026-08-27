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
