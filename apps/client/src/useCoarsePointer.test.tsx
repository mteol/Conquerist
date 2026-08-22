// @vitest-environment jsdom
import type { JSX } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from './test/dom';
import { useCoarsePointer } from './useCoarsePointer';

/**
 * Ein Stellvertreter fuer `matchMedia`, der seine Zuhoerer behaelt.
 *
 * Der Haken soll nicht nur die erste Antwort lesen, sondern auf einen Wechsel
 * hoeren - ein Tablet, an das eine Maus geht, ist ab diesem Moment ein
 * Schreibtisch. Das laesst sich nur pruefen, wenn der Stellvertreter den
 * Zuhoerer wirklich aufhebt und rufen kann.
 */
function stubMedia(matches: boolean): { set: (next: boolean) => void; listeners: number } {
  const listeners = new Set<() => void>();
  const state = { matches };

  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return state.matches;
    },
    media: query,
    onchange: null,
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));

  return {
    set(next: boolean) {
      state.matches = next;
      act(() => {
        for (const listener of listeners) listener();
      });
    },
    get listeners() {
      return listeners.size;
    },
  };
}

function Probe(): JSX.Element {
  return <span data-testid="answer">{useCoarsePointer() ? 'Finger' : 'Maus'}</span>;
}

const answer = (): string => screen.getByTestId('answer').textContent!;

afterEach(() => vi.unstubAllGlobals());

describe('useCoarsePointer', () => {
  it('sagt Finger, wenn der Hauptzeiger grob ist und nicht schweben kann', () => {
    stubMedia(true);
    render(<Probe />);

    expect(answer()).toBe('Finger');
  });

  it('sagt Maus am Schreibtisch', () => {
    stubMedia(false);
    render(<Probe />);

    expect(answer()).toBe('Maus');
  });

  /*
   * Ohne `matchMedia` wird nicht geraten - dieselbe Vorsicht wie in
   * `useSettledRoll`. In jsdom ist das der Normalfall und damit die stille
   * Voreinstellung jedes Tests, der nichts anderes sagt.
   */
  it('sagt Maus, wo es gar kein matchMedia gibt', () => {
    vi.stubGlobal('matchMedia', undefined);
    render(<Probe />);

    expect(answer()).toBe('Maus');
  });

  it('merkt, wenn eine Maus ans Tablet geht', () => {
    const media = stubMedia(true);
    render(<Probe />);
    expect(answer()).toBe('Finger');

    media.set(false);

    expect(answer()).toBe('Maus');
  });

  it('haengt seinen Zuhoerer beim Abraeumen wieder ab', () => {
    const media = stubMedia(true);
    const { unmount } = render(<Probe />);
    expect(media.listeners).toBe(1);

    unmount();

    expect(media.listeners).toBe(0);
  });
});
