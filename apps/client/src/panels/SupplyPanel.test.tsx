// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { CLASSIC_RULES, CLASSIC_RULES_56 } from '@conquerist/shared';
import { render, screen, userEvent } from '../test/dom';
import { SupplyPanel } from './SupplyPanel';

/**
 * Die Uebersicht ueber die Stapel.
 *
 * Sie beantwortet eine Frage, die das Brett nicht beantwortet: **wie viel liegt
 * noch da**. Deshalb steht neben jedem Rest die Ausgangsmenge - eine nackte
 * Zwoelf sagt nichts darueber, ob der Stapel halb voll oder fast leer ist.
 *
 * Eingeklappt, weil sie eine Auskunft ist und kein Bedienelement: wer sie nicht
 * braucht, soll keinen Platz dafuer hergeben.
 */
function panel(props: Partial<Parameters<typeof SupplyPanel>[0]> = {}) {
  return render(
    <SupplyPanel
      bank={{ brick: 12, lumber: 19, wool: 3, grain: 0, ore: 7 }}
      start={CLASSIC_RULES.resourceBank}
      deckLeft={9}
      deckStart={25}
      {...props}
    />,
  );
}

describe('Stapel-Uebersicht', () => {
  it('bleibt beim Start eingeklappt', () => {
    panel();

    expect(screen.getByTestId('supply-toggle').getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByTestId('supply-brick')).toBeNull();
  });

  it('zeigt die Stapel erst nach dem Aufklappen', async () => {
    panel();

    await userEvent.click(screen.getByTestId('supply-toggle'));

    expect(screen.getByTestId('supply-toggle').getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByTestId('supply-brick')).toBeDefined();
  });

  it('nennt zu jedem Rohstoff den Rest und die Ausgangsmenge', async () => {
    panel();
    await userEvent.click(screen.getByTestId('supply-toggle'));

    expect(screen.getByTestId('supply-brick').textContent).toContain('12');
    expect(screen.getByTestId('supply-brick').textContent).toContain('19');
    // Ein leerer Stapel verschwindet nicht - er sagt, dass er leer ist.
    expect(screen.getByTestId('supply-grain').textContent).toContain('0');
  });

  it('fuehrt den Entwicklungsstapel als sechsten Stapel', async () => {
    panel();
    await userEvent.click(screen.getByTestId('supply-toggle'));

    expect(screen.getByTestId('supply-deck').textContent).toContain('9');
    expect(screen.getByTestId('supply-deck').textContent).toContain('25');
  });

  /*
   * Die Ausgangsmenge kommt aus dem Regelwerk der Partie und steht nicht im
   * Code. Sonst behauptete die Uebersicht am Sechsertisch eine Neunzehn, die
   * es dort seit der Vorratsarbeit nicht mehr gibt.
   */
  it('nennt am Sechsertisch die groessere Ausgangsmenge', async () => {
    panel({ start: CLASSIC_RULES_56.resourceBank, bank: CLASSIC_RULES_56.resourceBank });
    await userEvent.click(screen.getByTestId('supply-toggle'));

    expect(screen.getByTestId('supply-brick').textContent).toContain('24');
    expect(screen.getByTestId('supply-brick').textContent).not.toContain('19');
  });
});
