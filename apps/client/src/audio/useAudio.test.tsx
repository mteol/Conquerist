// @vitest-environment jsdom
import type { JSX } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, userEvent } from '../test/dom';
import type { SoundEvent } from './cues';
import { MUSIC_TRACK } from './music';
import { AudioProvider, useCueSound } from './useAudio';

/*
 * Die Engine wird ersetzt: geprueft wird, **was** gespielt werden soll, nicht
 * ob WebAudio funktioniert - das gibt es in jsdom nicht. `vi.hoisted` deshalb,
 * weil `vi.mock` ueber die Importe gezogen wird und eine gewoehnliche Konstante
 * zu diesem Zeitpunkt noch nicht existierte.
 */
const { played, started } = vi.hoisted(() => ({
  played: [] as string[],
  started: [] as string[],
}));

vi.mock('./engine', () => ({
  createEngine: () => ({
    play: (sound: { cue: string }) => {
      played.push(sound.cue);
    },
    playMusic: (url: string) => {
      started.push(url);
    },
    apply: () => {},
    close: () => {},
  }),
}));

function Harness({ event }: { readonly event: SoundEvent | null }): JSX.Element {
  useCueSound(event);

  return (
    <>
      <button type="button">Bauen</button>
      <button type="button" disabled>
        Gesperrt
      </button>
      <button type="button" data-sound="confirm">
        Zusagen
      </button>
    </>
  );
}

const mount = (event: SoundEvent | null = null): ReturnType<typeof render> =>
  render(
    <AudioProvider>
      <Harness event={event} />
    </AudioProvider>,
  );

beforeEach(() => {
  played.length = 0;
  started.length = 0;
});

describe('der delegierte Klick', () => {
  it('macht aus jedem Knopfdruck einen Klang', async () => {
    mount();

    await userEvent.click(screen.getByText('Bauen'));

    expect(played).toEqual(['ui.click']);
  });

  it('laesst einen gesperrten Knopf stumm', async () => {
    mount();

    await userEvent.click(screen.getByText('Gesperrt'));

    expect(played).toEqual([]);
  });

  it('laesst data-sound den Vorgabeklang schlagen', async () => {
    mount();

    await userEvent.click(screen.getByText('Zusagen'));

    expect(played).toEqual(['ui.confirm']);
  });
});

/*
 * Die Musik haengt an derselben Geste wie der Ton ueberhaupt - und der Anlauf
 * bleibt bestehen, statt sich nach dem ersten Mal abzumelden. Dass hier zwei
 * Eintraege stehen, ist deshalb kein Fehler, sondern die Zusage: ein vom
 * Browser abgelehnter erster Versuch bekommt bei der naechsten Geste einen
 * zweiten. Ob daraus zwei Spuren werden, entscheidet die Engine, nicht dieser
 * Haken.
 */
describe('die Musik', () => {
  it('faengt nicht vor der ersten Geste an', () => {
    mount();

    expect(started).toEqual([]);
  });

  it('faengt bei der ersten Geste an', async () => {
    mount();

    await userEvent.click(screen.getByText('Bauen'));

    expect(started).toEqual([MUSIC_TRACK]);
  });

  it('faengt auch bei einer Taste an - sonst bliebe es ohne Maus still', () => {
    mount();

    fireEvent.keyDown(window, { key: 'Tab' });

    expect(started).toEqual([MUSIC_TRACK]);
  });
});

describe('useCueSound', () => {
  it('spielt einen neuen Klang genau einmal', () => {
    const { rerender } = mount({ seq: 1, sounds: [{ cue: 'build.city', gain: 1 }] });

    /*
     * Dasselbe Ereignis, aber ein neues Objekt - genau das passiert unter
     * `StrictMode` und bei jedem Rendern, das den Zustand nicht aendert. Ohne
     * die `seq`-Sperre klaenge jeder Zug doppelt.
     */
    rerender(
      <AudioProvider>
        <Harness event={{ seq: 1, sounds: [{ cue: 'build.city', gain: 1 }] }} />
      </AudioProvider>,
    );

    expect(played).toEqual(['build.city']);
  });

  it('spielt denselben Klang wieder, wenn er neu ausgeloest wurde', () => {
    const { rerender } = mount({ seq: 1, sounds: [{ cue: 'build.road', gain: 1 }] });

    rerender(
      <AudioProvider>
        <Harness event={{ seq: 2, sounds: [{ cue: 'build.road', gain: 1 }] }} />
      </AudioProvider>,
    );

    expect(played).toEqual(['build.road', 'build.road']);
  });

  it('spielt alle Klaenge eines Zuges der Reihe nach', () => {
    mount({
      seq: 1,
      sounds: [
        { cue: 'dice.roll', gain: 1 },
        { cue: 'dice.land', gain: 1, note: 9 },
        { cue: 'gain.self', gain: 1 },
      ],
    });

    expect(played).toEqual(['dice.roll', 'dice.land', 'gain.self']);
  });
});
