import { vi } from 'vitest';
import { fireEvent } from './dom';
import { edgeMidpoint, hexCenter, vertexPoint, type Point } from '../board/layout';
import { hexFromId } from '@conquerist/shared';

/**
 * Auf das Brett tippen - und danach bestaetigen.
 *
 * Seit dem Umbau auf schmale Geraete faengt **eine** durchsichtige Flaeche alle
 * Klicks, und `nearestTarget` macht daraus ein Ziel. Ein Test kann deshalb
 * nicht mehr auf `vertex-…` klicken; er tippt an eine Stelle des Bretts.
 *
 * Zwei Kunstgriffe, beide unvermeidlich: jsdom kennt `getScreenCTM` nicht, also
 * steht dort eine Einheitsmatrix - damit sind Klick- und viewBox-Koordinaten
 * dasselbe. Und geklickt wird ueber `fireEvent` statt `userEvent`, weil
 * letzteres die Koordinaten aus dem Zielrechteck nimmt und dabei rundet; auf
 * einem Brett, das keine zehn Einheiten breit ist, waere danach jede
 * Genauigkeit weg.
 */
export function tapBoardAt(container: HTMLElement, point: Point): void {
  const svg = container.querySelector('svg');
  if (svg === null) throw new Error('tapBoardAt: kein Brett im Bildschirm');

  svg.getScreenCTM = () =>
    ({ inverse: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) }) as unknown as DOMMatrix;

  const catcher = container.querySelector('[data-testid="board-catcher"]');
  if (catcher === null) throw new Error('tapBoardAt: keine Fangflaeche im Brett');

  fireEvent.click(catcher, { clientX: point.x, clientY: point.y });
}

/** Tippt auf einen Knoten. */
export function tapVertex(container: HTMLElement, vertex: string): void {
  tapBoardAt(container, vertexPoint(vertex));
}

/** Tippt auf eine Kante. */
export function tapEdge(container: HTMLElement, edge: string): void {
  tapBoardAt(container, edgeMidpoint(edge));
}

/** Tippt auf ein Feld. */
export function tapHex(container: HTMLElement, hex: string): void {
  tapBoardAt(container, hexCenter(hexFromId(hex)));
}

/**
 * Stellt fuer diesen Test ein Handy oder Tablet hin.
 *
 * jsdom kennt `matchMedia` gar nicht, und `useCoarsePointer` antwortet dann
 * `false` - jeder Test laeuft also am Schreibtisch, was die ehrliche
 * Voreinstellung ist. Wer den Weg mit dem Finger pruefen will, sagt das hier.
 *
 * `vi.stubGlobal` und keine Zuweisung von Hand: nur so raeumt Vitest den
 * Stellvertreter am Ende der Datei wieder weg. Sonst bliebe das Handy stehen
 * und faerbte jeden Block, der danach in derselben Datei laeuft - ein Geraet,
 * das ein Test gestellt hat und ein anderer erbt, ist die stillste Art, sich
 * eine gruene Zeile zu erschleichen.
 */
export function asTouchDevice(coarse = true): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: coarse && /pointer:\s*coarse/.test(query),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
}

/**
 * Bestaetigt die stehende Auswahl.
 *
 * Wirft, wenn keine steht: ein Test, der bestaetigen will und nichts gewaehlt
 * hat, hat sein Ziel verfehlt und soll das sagen, statt still weiterzulaufen.
 */
export function confirmPlacement(container: HTMLElement): void {
  const button = confirmButton(container);
  if (button === undefined) throw new Error('confirmPlacement: nichts steht zur Bestaetigung an');

  fireEvent.click(button);
}

function confirmButton(container: HTMLElement): HTMLButtonElement | undefined {
  return [...container.querySelectorAll('button')].find(
    (candidate) => candidate.textContent === 'Hier setzen',
  );
}

/**
 * Setzen - der gewoehnliche Fall, auf dem Geraet, das der Test gerade stellt.
 *
 * Ein Tipp, und **falls** das Geraet nachfragt, die Bestaetigung: am
 * Schreibtisch ist das ein Schritt, am Finger sind es zwei. Die Helfer bilden
 * damit ab, was „setzen" heisst, und nicht einen der beiden Wege - sonst
 * muesste jeder Aufrufer wissen, welches Geraet gerade eingestellt ist.
 */
export function placeVertex(container: HTMLElement, vertex: string): void {
  tapVertex(container, vertex);
  confirmIfAsked(container);
}

export function placeEdge(container: HTMLElement, edge: string): void {
  tapEdge(container, edge);
  confirmIfAsked(container);
}

export function placeHex(container: HTMLElement, hex: string): void {
  tapHex(container, hex);
  confirmIfAsked(container);
}

function confirmIfAsked(container: HTMLElement): void {
  const button = confirmButton(container);
  if (button !== undefined) fireEvent.click(button);
}
