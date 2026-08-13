// @vitest-environment jsdom
import type { ComponentProps, JSX } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CLASSIC_DICE, type DiceSpec, type Roll } from '@conquerist/shared';
import { render, screen, userEvent } from '../test/dom';
import { DiceTray } from './DiceTray';

/**
 * Die Wuerfel als Zug.
 *
 * Gepruef wird nicht, DASS sie sich bewegen - das kann jsdom nicht sehen und es
 * waere auch die falsche Zusage. Gepruef wird, dass alles, was die Bewegung
 * sagt, ohne sie am Bildschirm steht: die Aufforderung als Wort, der Wurf als
 * Zahl. Wer `prefers-reduced-motion` gesetzt hat, verliert damit nichts.
 */
const ROLL: Roll = [
  { die: 'first', value: 5 },
  { die: 'second', value: 3 },
];

function tray(props: Partial<ComponentProps<typeof DiceTray>> = {}): JSX.Element {
  return (
    <DiceTray
      spec={CLASSIC_DICE}
      roll={ROLL}
      total={8}
      canRoll={false}
      fell={false}
      onRoll={vi.fn()}
      {...props}
    />
  );
}

describe('DiceTray', () => {
  it('zeigt die Summe des Wurfs', () => {
    render(tray());

    expect(screen.getByTestId('dice').textContent).toContain('8');
  });

  it('sagt die Augen an, statt sie nur zu zeichnen', () => {
    render(tray());

    expect(screen.getByTestId('dice').getAttribute('aria-label')).toBe('Wurf: 5 und 3, zusammen 8');
  });

  it('fordert mit einem Wort zum Werfen auf, nicht nur mit Bewegung', () => {
    render(tray({ canRoll: true }));

    const dice = screen.getByTestId('dice');
    expect(dice).toHaveProperty('disabled', false);
    expect(dice.getAttribute('aria-label')).toBe('Würfeln');
    // Dasselbe noch einmal sichtbar - das Atmen faellt bei reduzierter
    // Bewegung weg, dieses Wort nicht.
    expect(screen.getByText('Würfeln')).toBeDefined();
  });

  it('nimmt keinen Klick an, wenn der Zug nicht erlaubt ist', async () => {
    const onRoll = vi.fn();
    render(tray({ canRoll: false, onRoll }));

    await userEvent.click(screen.getByTestId('dice'));
    expect(onRoll).not.toHaveBeenCalled();
  });

  it('wirft auf Klick', async () => {
    const onRoll = vi.fn();
    render(tray({ canRoll: true, onRoll }));

    await userEvent.click(screen.getByTestId('dice'));
    expect(onRoll).toHaveBeenCalledTimes(1);
  });

  it('zeigt so viele Wuerfel, wie das Regelwerk hat', () => {
    // Die Erweiterungsprobe: ein dritter Wuerfel braucht hier keine Zeile.
    const spec: DiceSpec = [...CLASSIC_DICE, { id: 'event', faces: 6, countsTowardYield: false }];

    const { container } = render(tray({ spec }));

    expect(container.querySelectorAll('.die')).toHaveLength(3);
  });

  it('laesst einen Wuerfel leer, zu dem es kein Ergebnis gibt', () => {
    const { container } = render(tray({ roll: null, total: null }));

    expect(container.querySelectorAll('.die--blank')).toHaveLength(2);
    expect(screen.getByTestId('dice').getAttribute('aria-label')).toBe('Noch kein Wurf');
  });

  it('schreibt die Zahl aus, wo es kein gewohntes Augenbild gibt', () => {
    const spec: DiceSpec = [{ id: 'gross', faces: 12, countsTowardYield: true }];
    const roll: Roll = [{ die: 'gross', value: 11 }];

    const { container } = render(tray({ spec, roll, total: 11 }));

    expect(container.querySelector('.die--numeral')?.textContent).toBe('11');
  });
});
