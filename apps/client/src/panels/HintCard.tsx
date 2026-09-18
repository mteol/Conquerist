import { useEffect, useLayoutEffect, useRef, useState, type JSX } from 'react';
import { createPortal } from 'react-dom';

/**
 * Ein Auskunftskaertchen beim Darueberfahren.
 *
 * **Warum nicht `title`.** Der Browser zeigt `title` erst nach rund einer
 * Sekunde, in Systemschrift, einzeilig und ohne Gliederung - und auf dem Brett
 * gar nicht, weil dort eine Fangflaeche ueber allem liegt. Die Auskunft ist
 * aber genau das, was man beim Lernen des Spiels sucht; sie bekommt deshalb
 * eine eigene, ruhige Form im Pergament der Bedienung.
 *
 * Es haengt am `body` und steht `fixed`: so schneidet es keine Ecke mit
 * `overflow: hidden` ab, und es verschiebt nichts im Layout.
 */
export interface Hint {
  readonly title: string;
  readonly lines: readonly string[];
}

/** Woran das Kaertchen haengt, in Fensterkoordinaten. */
export interface HintAnchor {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** Abstand zum Anker und zum Fensterrand, in px. */
const GAP = 10;

export function HintCard({
  hint,
  anchor,
}: {
  readonly hint: Hint;
  readonly anchor: HintAnchor;
}): JSX.Element {
  const box = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null);

  /*
   * Erst messen, dann setzen: die Groesse haengt am Text. Ueber dem Anker,
   * mittig; passt es oben nicht hin, darunter. Waagerecht ins Fenster geklemmt.
   */
  useLayoutEffect(() => {
    const element = box.current;
    if (element === null) return;

    const { width, height } = element.getBoundingClientRect();
    const center = (anchor.left + anchor.right) / 2;
    const left = Math.min(
      Math.max(GAP, center - width / 2),
      Math.max(GAP, window.innerWidth - width - GAP),
    );
    const above = anchor.top - GAP - height;
    const top =
      above >= GAP ? above : Math.min(anchor.bottom + GAP, window.innerHeight - height - GAP);

    setPlace({ left, top });
  }, [hint, anchor]);

  return createPortal(
    <div
      ref={box}
      className="hintcard"
      role="tooltip"
      style={
        place === null
          ? { left: 0, top: 0, visibility: 'hidden' }
          : { left: place.left, top: place.top }
      }
    >
      <strong className="hintcard__title">{hint.title}</strong>
      {hint.lines.map((line, index) => (
        <span key={index} className="hintcard__line">
          {line}
        </span>
      ))}
    </div>,
    document.body,
  );
}

/** Was die Ebene aufgreift: eine ausfuehrliche Auskunft oder ein schlichtes `title`. */
const HINTED = '[data-hint-title], [title], [data-title]';

/**
 * Liest die Auskunft aus einem Element: `data-hint-title` und `data-hint`
 * (Zeilen durch Zeilenumbruch getrennt) - sonst das `title`, einzeilig.
 */
export function hintOf(element: Element): Hint | null {
  const title =
    element.getAttribute('data-hint-title') ??
    element.getAttribute('title') ??
    element.getAttribute('data-title');
  if (title === null || title === '') return null;

  const lines = (element.getAttribute('data-hint') ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
  return { title, lines };
}

/** Wie lange der Zeiger ruhen muss, bevor das Kaertchen kommt - gegen Flackern. */
const DELAY = 180;

/**
 * Wie lange ein Finger liegen muss, bis es eine Auskunft ist und kein Tipp.
 * Knapp ueber der Zeit, die ein zoegerlicher Tipp dauert; das System-Kontextmenue
 * kommt erst spaeter und wird unterdrueckt, solange ein Kaertchen ansteht.
 */
export const LONG_PRESS = 480;

/** Wie weit der Finger wandern darf, bevor es ein Wischen ist, in px. */
const SLOP = 10;

/**
 * Eine Ebene fuer alle Elemente mit `data-hint-title`.
 *
 * **Ein Zuhoerer statt einer Huelle um jedes Element.** Die Auskunft steht als
 * Attribut an dem Ding, das sie erklaert - dort, wo schon der Name steht -, und
 * diese Ebene zeigt sie. Auch beim Tastaturfokus, damit sie nicht an der Maus
 * haengt.
 *
 * **Auf Touch per langem Druecken.** Ein kurzer Tipp bleibt ein Klick; liegt
 * der Finger `LONG_PRESS` lang still, kommt das Kaertchen, und der Klick beim
 * Loslassen wird geschluckt - sonst baute, wer nur nachfragen wollte, gleich
 * mit. Es bleibt stehen, bis der naechste Finger kommt.
 */
export function HintLayer(): JSX.Element | null {
  const [shown, setShown] = useState<{ hint: Hint; anchor: HintAnchor } | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let current: Element | null = null;

    /*
     * Solange das Kaertchen steht, ruht das `title` des Elements - sonst kaeme
     * eine Sekunde spaeter der Browser mit derselben Auskunft noch einmal.
     */
    const park = (element: Element) => {
      const title = element.getAttribute('title');
      if (title === null) return;
      element.setAttribute('data-title', title);
      element.removeAttribute('title');
    };
    const unpark = (element: Element) => {
      const title = element.getAttribute('data-title');
      if (title === null) return;
      if (!element.hasAttribute('title')) element.setAttribute('title', title);
      element.removeAttribute('data-title');
    };

    /** Ob ein langes Druecken gegriffen hat - dann gehoert der naechste Klick ihm. */
    let swallow = false;
    let pressedAt: { x: number; y: number } | null = null;

    const show = (element: Element | null, delay = DELAY, onShown?: () => void) => {
      if (element === current) return;
      if (current !== null) unpark(current);
      current = element;
      if (element !== null) park(element);
      clearTimeout(timer);
      if (element === null) {
        setShown(null);
        return;
      }
      timer = setTimeout(() => {
        const hint = hintOf(element);
        if (hint === null || !element.isConnected) return;
        const rect = element.getBoundingClientRect();
        setShown({
          hint,
          anchor: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
        });
        onShown?.();
      }, delay);
    };

    const over = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      show(event.target instanceof Element ? event.target.closest(HINTED) : null);
    };
    const focus = (event: FocusEvent) => {
      const target = event.target;
      if (target instanceof Element && target.matches(':focus-visible')) {
        show(target.closest(HINTED));
      }
    };
    const away = () => show(null);
    const out = (event: PointerEvent) => {
      if (event.relatedTarget === null) show(null);
    };

    const down = (event: PointerEvent) => {
      show(null);
      swallow = false;
      pressedAt = null;
      if (event.pointerType === 'mouse') return;

      const element = event.target instanceof Element ? event.target.closest(HINTED) : null;
      if (element === null) return;
      pressedAt = { x: event.clientX, y: event.clientY };
      show(element, LONG_PRESS, () => {
        swallow = true;
      });
    };
    /** Losgelassen, bevor es lang genug war: ein gewoehnlicher Tipp. */
    const up = () => {
      pressedAt = null;
      if (!swallow) show(null);
    };
    const move = (event: PointerEvent) => {
      if (pressedAt === null || swallow) return;
      if (Math.hypot(event.clientX - pressedAt.x, event.clientY - pressedAt.y) > SLOP) up();
    };
    const click = (event: MouseEvent) => {
      if (!swallow) return;
      swallow = false;
      event.preventDefault();
      event.stopPropagation();
    };
    const menu = (event: Event) => {
      if (pressedAt !== null || swallow) event.preventDefault();
    };

    document.addEventListener('pointerover', over);
    document.addEventListener('pointerout', out);
    document.addEventListener('focusin', focus);
    document.addEventListener('focusout', away);
    document.addEventListener('pointerdown', down);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);
    document.addEventListener('pointermove', move);
    document.addEventListener('click', click, true);
    document.addEventListener('contextmenu', menu);
    window.addEventListener('scroll', away, true);

    return () => {
      clearTimeout(timer);
      if (current !== null) unpark(current);
      document.removeEventListener('pointerover', over);
      document.removeEventListener('pointerout', out);
      document.removeEventListener('focusin', focus);
      document.removeEventListener('focusout', away);
      document.removeEventListener('pointerdown', down);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
      document.removeEventListener('pointermove', move);
      document.removeEventListener('click', click, true);
      document.removeEventListener('contextmenu', menu);
      window.removeEventListener('scroll', away, true);
    };
  }, []);

  return shown === null ? null : <HintCard hint={shown.hint} anchor={shown.anchor} />;
}
