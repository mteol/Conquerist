// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render } from '../test/dom';
import { Wordmark } from './Wordmark';

describe('Wortmarke', () => {
  it('zeichnet zehn Buchstaben, jeden an seinem Platz', () => {
    const { container } = render(<Wordmark />);

    const letters = container.querySelectorAll('.wordmark__letter');
    expect(letters.length).toBe(10);

    // Die Buchstaben stehen nebeneinander, nicht uebereinander: jeder Platz
    // liegt weiter rechts als der vorige. Ein zusammengefallenes Wort waere
    // sonst erst im Browser zu sehen.
    const positions = [...letters].map((letter) => {
      const match = /translate\(([\d.]+) 0\)/.exec(letter.getAttribute('transform') ?? '');
      return Number(match?.[1]);
    });

    expect(positions[0]).toBe(0);
    expect(positions.every(Number.isFinite)).toBe(true);
    for (let i = 1; i < positions.length; i += 1) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1] as number);
    }
  });

  it('haelt die Position am Attribut und die Reihenfolge an der Variable', () => {
    const { container } = render(<Wordmark />);

    // Beides muss getrennt bleiben: die Position steht als
    // SVG-Praesentationsattribut auf der Gruppe, die Animation laeuft im CSS
    // auf dem `path` darin. Stuende die Animation auf der Gruppe, schlueg sie
    // das Attribut und alle zehn Buchstaben laegen auf x = 0.
    const third = container.querySelectorAll('.wordmark__letter')[2] as HTMLElement;
    expect(third.getAttribute('transform')).toMatch(/^translate\(/);
    expect(third.style.getPropertyValue('--i')).toBe('2');
    expect(third.style.transform).toBe('');
    expect(third.querySelectorAll(':scope > path').length).toBe(1);
  });

  it('animiert nur, wenn sie gefragt wird', () => {
    const still = render(<Wordmark />);
    expect(still.container.querySelector('.wordmark--enter')).toBeNull();

    const entering = render(<Wordmark animated />);
    expect(entering.container.querySelector('.wordmark--enter')).not.toBeNull();
  });

  it('ist fuer Vorlesegeraete nicht da - den Namen traegt die Ueberschrift', () => {
    const { container } = render(<Wordmark />);

    const svg = container.querySelector('.wordmark');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
  });
});
