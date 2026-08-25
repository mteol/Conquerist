// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '../test/dom';
import { BarbarianTrack } from './BarbarianTrack';

/**
 * Die Fahrstrecke.
 *
 * Geprüft wird nicht, DASS das Schiff gleitet - das kann jsdom nicht sehen.
 * Geprüft wird, daß alles, was die Bewegung sagt, auch ohne sie dasteht: wie
 * viele Felder es sind, auf welchem das Schiff steht, und wie stark die
 * Barbaren sind.
 */
describe('BarbarianTrack', () => {
  it('zeigt sieben Stationen und das Schiff auf seinem Feld', () => {
    render(
      <BarbarianTrack
        barbarians={{ position: 2, attacks: 0 }}
        track={7}
        strength={3}
        defenders={null}
      />,
    );

    expect(screen.getAllByTestId('barbarian-station')).toHaveLength(7);
    expect(screen.getByTestId('barbarian-ship').getAttribute('data-position')).toBe('2');
  });

  /*
   * Die Position steht als Anteil im `style` und wird erst im Blatt in Pixel
   * umgerechnet - die Komponente kennt die Breite der Leiste nicht.
   */
  it('gibt die Lage als Anteil weiter, nicht als Pixel', () => {
    render(
      <BarbarianTrack
        barbarians={{ position: 3, attacks: 0 }}
        track={7}
        strength={1}
        defenders={null}
      />,
    );

    const ship = screen.getByTestId('barbarian-ship');
    expect(ship.style.getPropertyValue('--progress')).toBe('0.5');
  });

  it('nennt die Staerke der Barbaren als Zahl, nicht nur als Balken', () => {
    render(
      <BarbarianTrack
        barbarians={{ position: 0, attacks: 0 }}
        track={7}
        strength={3}
        defenders={null}
      />,
    );

    expect(screen.getByLabelText('Barbaren: 3')).toBeDefined();
  });

  /*
   * Solange es keine Ritter gibt, steht dort keine Null. Eine Zahl, die
   * niemals steigen kann, sagt "gerade nicht" ueber etwas, das nie geht -
   * dieselbe Falle wie beim Siegpunkt-Knopf (CLAUDE.md).
   */
  it('laesst die Ritterstaerke weg, solange es keine gibt', () => {
    render(
      <BarbarianTrack
        barbarians={{ position: 0, attacks: 0 }}
        track={7}
        strength={3}
        defenders={null}
      />,
    );

    expect(screen.queryByLabelText(/^Ritter/)).toBeNull();
  });

  it('zeigt sie, sobald es eine gibt', () => {
    render(
      <BarbarianTrack
        barbarians={{ position: 0, attacks: 0 }}
        track={7}
        strength={3}
        defenders={2}
      />,
    );

    expect(screen.getByLabelText('Ritter: 2')).toBeDefined();
  });

  it('sagt die Naehe der Gefahr auch als Satz', () => {
    render(
      <BarbarianTrack
        barbarians={{ position: 4, attacks: 0 }}
        track={7}
        strength={2}
        defenders={null}
      />,
    );

    expect(screen.getByLabelText('Die Barbaren sind 4 von 6 Feldern nah')).toBeDefined();
  });

  it('bleibt weg, wenn an diesem Tisch kein Schiff faehrt', () => {
    const { container } = render(
      <BarbarianTrack barbarians={null} track={0} strength={0} defenders={null} />,
    );

    expect(container.innerHTML).toBe('');
  });
});
