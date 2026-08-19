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

  /*
   * **Der Wurf ueber das Brett.** Gepruef wird nicht, DASS etwas fliegt - eine
   * Animation kann jsdom nicht sehen. Gepruef wird, was daran haengt und was
   * ohne sie falsch waere: dass die Kuben auf der geworfenen Zahl stehen, dass
   * die Summe erst mit der Landung erscheint, und dass niemand waehrend des
   * Fluges ein zweites Mal werfen kann.
   */
  it('stellt die Kuben auf die geworfene Zahl', () => {
    render(
      tray({
        canRoll: false,
        roll: null,
        total: null,
        landing: [
          { die: 'first', value: 5 },
          { die: 'second', value: 3 },
        ],
      }),
    );

    expect(screen.getByTestId('cube-5')).toBeDefined();
    expect(screen.getByTestId('cube-3')).toBeDefined();
  });

  it('laesst waehrend des Fluges nicht noch einmal werfen', async () => {
    const onRoll = vi.fn();
    render(
      tray({
        canRoll: true,
        onRoll,
        landing: [
          { die: 'first', value: 2 },
          { die: 'second', value: 2 },
        ],
      }),
    );

    const dice = screen.getByTestId('dice');
    // Die Klickkarte stammt aus dem Stand von vorhin und laesst das Werfen
    // selbstverstaendlich noch zu - der Becher weiss es besser.
    expect(dice).toHaveProperty('disabled', true);
    expect(dice.getAttribute('aria-label')).toBe('Die Würfel fallen');

    await userEvent.click(dice);
    expect(onRoll).not.toHaveBeenCalled();
  });

  it('haelt die Summe zurueck, solange die Wuerfel unterwegs sind', () => {
    render(tray({ total: 8, landing: [{ die: 'first', value: 5 }] }));

    // Sie ist die Antwort, auf die man wartet - sie darf nicht vor dem Wuerfel
    // dastehen, der sie zeigen soll.
    expect(screen.getByTestId('dice').textContent).not.toContain('8');
  });

  /*
   * Ein Kubus hat sechs Flaechen. Fuer einen achtseitigen Wuerfel aus einem
   * spaeteren Regelwerk gaebe es keine Zuordnung, und eine erfundene waere
   * schlechter als keine - dann bleibt es beim Umspringen an Ort und Stelle.
   */
  it('wirft nicht, was kein Kubus ist', () => {
    const eight: DiceSpec = [{ id: 'first', faces: 8, countsTowardYield: true }];

    render(
      tray({
        spec: eight,
        roll: [{ die: 'first', value: 7 }],
        total: 7,
        landing: [{ die: 'first', value: 7 }],
      }),
    );

    expect(screen.queryByTestId(/^cube-/)).toBeNull();
    // Stattdessen die flache Ziffer - ueber sechs Seiten gibt es kein gewohntes
    // Augenbild mehr, und ein erfundenes waere schlechter als eine Zahl.
    expect(screen.getByTestId('dice').querySelector('.die--numeral')?.textContent).toBe('7');
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
