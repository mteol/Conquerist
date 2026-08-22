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
 * Bestaetigt die stehende Auswahl.
 *
 * Wirft, wenn keine steht: ein Test, der bestaetigen will und nichts gewaehlt
 * hat, hat sein Ziel verfehlt und soll das sagen, statt still weiterzulaufen.
 */
export function confirmPlacement(container: HTMLElement): void {
  const button = [...container.querySelectorAll('button')].find(
    (candidate) => candidate.textContent === 'Hier setzen',
  );
  if (button === undefined) throw new Error('confirmPlacement: nichts steht zur Bestaetigung an');

  fireEvent.click(button);
}

/** Tippen und bestaetigen in einem - der gewoehnliche Fall. */
export function placeVertex(container: HTMLElement, vertex: string): void {
  tapVertex(container, vertex);
  confirmPlacement(container);
}

export function placeEdge(container: HTMLElement, edge: string): void {
  tapEdge(container, edge);
  confirmPlacement(container);
}

export function placeHex(container: HTMLElement, hex: string): void {
  tapHex(container, hex);
  confirmPlacement(container);
}
