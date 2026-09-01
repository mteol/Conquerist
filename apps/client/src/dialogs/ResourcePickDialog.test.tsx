// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { RESOURCE_IDS } from '@conquerist/shared';
import { render, screen, userEvent } from '../test/dom';
import { ResourcePickDialog } from './ResourcePickDialog';

describe('ResourcePickDialog', () => {
  it('bietet mit onClose einen Schliessweg: das Kreuz und "Abbrechen"', () => {
    render(
      <ResourcePickDialog
        title="Monopol"
        hint="Sorte wählen."
        pool={RESOURCE_IDS}
        count={1}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByTestId('modal-close')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Abbrechen' })).toBeDefined();
  });

  /*
   * Fixrunde 1, WICHTIG 1: ohne `onClose` darf es KEIN Bedienelement geben,
   * das einen Schliessweg verspricht - weder das X (dessen `aria-label`
   * ausdruecklich "... schließen" sagt) noch "Abbrechen". Ein Test, der nur
   * die (dann gar nicht existierende) Funktion prueft, faengt den Befund
   * nicht - das hier prueft die Abwesenheit der Bedienelemente selbst.
   */
  it('bietet ohne onClose keinerlei Bedienelement mit einem Schliess-Label - eine Pflichtwahl', () => {
    render(
      <ResourcePickDialog
        title="Aquädukt: welcher Rohstoff?"
        hint="Ein Rohstoff deiner Wahl."
        pool={RESOURCE_IDS}
        count={1}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('modal-close')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Abbrechen' })).toBeNull();
    expect(screen.queryByRole('button', { name: /schließen/i })).toBeNull();
  });

  it('reagiert ohne onClose nicht auf Escape - es gibt nichts abzubrechen', async () => {
    render(
      <ResourcePickDialog
        title="Aquädukt: welcher Rohstoff?"
        hint="Ein Rohstoff deiner Wahl."
        pool={RESOURCE_IDS}
        count={1}
        onConfirm={vi.fn()}
      />,
    );

    await userEvent.keyboard('{Escape}');

    // Der Dialog steht unveraendert - kein Absturz, kein stiller Handler.
    expect(screen.getByRole('dialog', { name: 'Aquädukt: welcher Rohstoff?' })).toBeDefined();
  });

  it('meldet die Auswahl unveraendert, mit oder ohne onClose', async () => {
    const onConfirm = vi.fn();
    render(
      <ResourcePickDialog
        title="Aquädukt: welcher Rohstoff?"
        hint="Ein Rohstoff deiner Wahl."
        pool={RESOURCE_IDS}
        count={1}
        onConfirm={onConfirm}
      />,
    );

    await userEvent.click(screen.getByTestId('pick-ore'));
    await userEvent.click(screen.getByRole('button', { name: 'Karte spielen' }));

    expect(onConfirm).toHaveBeenCalledWith(['ore']);
  });
});
