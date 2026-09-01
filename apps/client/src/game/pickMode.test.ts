// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '../test/dom';
import { usePickMode } from './pickMode';

describe('usePickMode', () => {
  it('zeigt vor der Wahl keine Ziele', () => {
    const { result } = renderHook(() => usePickMode(() => ['a', 'b']));
    expect(result.current.targets).toEqual([]);
  });

  it('zeigt nach der Wahl die Ziele der Absicht', () => {
    const { result } = renderHook(() => usePickMode((k: string) => (k === 'road' ? ['e1'] : [])));
    act(() => result.current.begin('road'));
    expect(result.current.targets).toEqual(['e1']);
  });

  it('vergisst die Absicht beim Abbrechen', () => {
    const { result } = renderHook(() => usePickMode(() => ['a']));
    act(() => result.current.begin('x'));
    act(() => result.current.cancel());
    expect(result.current.intent).toBeNull();
    expect(result.current.targets).toEqual([]);
  });

  /*
   * Der eigentliche Grund für den Haken: ein Feld, ein Wert. Zwei Absichten
   * gleichzeitig gibt es nicht, weil es sie nicht geben *kann* - und nicht,
   * weil drei Setzer sich gegenseitig aufräumen.
   */
  it('ersetzt eine laufende Absicht durch die neue', () => {
    const { result } = renderHook(() =>
      usePickMode((k: string) => (k === 'road' ? ['e1'] : ['v1'])),
    );
    act(() => result.current.begin('road'));
    act(() => result.current.begin('settlement'));
    expect(result.current.intent).toBe('settlement');
    expect(result.current.targets).toEqual(['v1']);
  });

  /*
   * Und die zweite Hälfte davon: die Absicht darf mitwachsen. Der Ritterzug
   * merkt sich nach dem ersten Klick, *welcher* Ritter versetzt wird - das ist
   * dieselbe Absicht in einem weiteren Schritt und keine neue.
   */
  it('nimmt eine genauere Fassung derselben Absicht entgegen', () => {
    const { result } = renderHook(() =>
      usePickMode((step: { readonly from: string | null }) =>
        step.from === null ? ['k1'] : ['v9'],
      ),
    );
    act(() => result.current.begin({ from: null }));
    expect(result.current.targets).toEqual(['k1']);
    act(() => result.current.begin({ from: 'k1' }));
    expect(result.current.targets).toEqual(['v9']);
  });
});
