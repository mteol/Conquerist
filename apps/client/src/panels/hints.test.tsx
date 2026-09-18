// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { cardAmounts } from '@conquerist/shared';

import { buildHint } from './ActionPanel';
import { barbarianHint } from './BarbarianTrack';
import { HintLayer, hintOf } from './HintCard';
import { act, fireEvent, render, screen } from '../test/dom';
import { trackStepHint } from './TrackPanel';

const city = cardAmounts({ grain: 2, ore: 3 });

describe('buildHint', () => {
  it('sagt am gesperrten Bauteil, welche Karten fehlen', () => {
    const lines = buildHint({
      spots: 0,
      left: 4,
      cost: city,
      hand: cardAmounts({ grain: 2, ore: 1 }),
      setup: false,
    });

    expect(lines[0]).toBe('Kostet 2 Korn, 3 Erz.');
    expect(lines).toContain('Dir fehlt 2 Erz.');
    expect(lines).toContain('Noch 4 im Vorrat.');
  });

  it('nennt einen leeren Vorrat statt fehlender Karten', () => {
    const lines = buildHint({ spots: 0, left: 0, cost: city, hand: null, setup: false });

    expect(lines).toContain('Keins mehr im Vorrat.');
  });

  it('verraet ohne sichtbare Hand nichts ueber sie', () => {
    const lines = buildHint({ spots: 0, left: 2, cost: city, hand: null, setup: false });

    expect(lines.join(' ')).not.toContain('fehlt');
  });

  it('nennt in der Gruendung keinen Preis', () => {
    const lines = buildHint({ spots: 54, left: 5, cost: city, hand: null, setup: true });

    expect(lines[0]).toBe('In der Gründung kostenlos.');
    expect(lines[1]).toContain('54 Stellen');
  });
});

describe('trackStepHint', () => {
  it('erklaert Preis, Kartenschwelle und Zusatznutzen', () => {
    const lines = trackStepHint('science', 3, false);

    expect(lines[0]).toContain('Papier');
    expect(lines[1]).toContain('höchstens 4');
    expect(lines.some((line) => line.startsWith('Aquädukt'))).toBe(true);
  });

  it('nennt an Stufe 4 die Metropole', () => {
    expect(trackStepHint('trade', 4, true).join(' ')).toContain('Metropole');
  });
});

describe('barbarianHint', () => {
  it('zaehlt die Schiffe bis zur Kueste und stellt die Staerken gegeneinander', () => {
    const lines = barbarianHint(3, 5, 2);

    expect(lines[0]).toContain('noch 3');
    expect(lines[1]).toContain('5');
    expect(lines[2]).toContain('zusammen 2');
  });
});

describe('hintOf', () => {
  it('liest Titel und Zeilen aus den Attributen', () => {
    const element = document.createElement('div');
    element.setAttribute('data-hint-title', 'Stadt');
    element.setAttribute('data-hint', 'Kostet 2 Korn.\n\nNoch 3 im Vorrat.');

    expect(hintOf(element)).toEqual({
      title: 'Stadt',
      lines: ['Kostet 2 Korn.', 'Noch 3 im Vorrat.'],
    });
  });

  it('greift auf ein schlichtes title zurueck', () => {
    const element = document.createElement('button');
    element.setAttribute('title', 'Noch 25 Karten im Stapel');

    expect(hintOf(element)).toEqual({ title: 'Noch 25 Karten im Stapel', lines: [] });
  });
});

describe('HintLayer auf Touch', () => {
  function setup() {
    const onClick = vi.fn();
    render(
      <>
        <HintLayer />
        <button type="button" data-hint-title="Stadt" data-hint="Kostet 2 Korn." onClick={onClick}>
          Stadt
        </button>
      </>,
    );
    return { onClick, button: screen.getByRole('button', { name: 'Stadt' }) };
  }

  it('zeigt nach langem Druecken die Auskunft und schluckt den Klick', () => {
    vi.useFakeTimers();
    try {
      const { onClick, button } = setup();

      fireEvent.pointerDown(button, { pointerType: 'touch', clientX: 5, clientY: 5 });
      act(() => {
        vi.advanceTimersByTime(600);
      });
      expect(screen.getByRole('tooltip').textContent).toContain('Kostet 2 Korn.');

      fireEvent.pointerUp(button, { pointerType: 'touch' });
      fireEvent.click(button);
      expect(onClick).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('laesst einen kurzen Tipp durch und zeigt nichts', () => {
    vi.useFakeTimers();
    try {
      const { onClick, button } = setup();

      fireEvent.pointerDown(button, { pointerType: 'touch', clientX: 5, clientY: 5 });
      act(() => {
        vi.advanceTimersByTime(100);
      });
      fireEvent.pointerUp(button, { pointerType: 'touch' });
      fireEvent.click(button);
      act(() => {
        vi.advanceTimersByTime(600);
      });

      expect(onClick).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('tooltip')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
