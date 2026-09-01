import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

/**
 * Gemeinsamer Einstieg fuer alle Tests, die wirklich rendern.
 *
 * Testing Library raeumt nur automatisch auf, wenn Vitest mit globalen
 * Testfunktionen laeuft - das tut dieses Repo nicht. Statt in jeder Datei ein
 * `afterEach(cleanup)` zu wiederholen, steht es hier einmal und kommt mit dem
 * Import mit.
 *
 * Wer hieraus importiert, braucht `// @vitest-environment jsdom` in der ersten
 * Zeile seiner Testdatei - die Voreinstellung im Repo ist `node`.
 */
afterEach(cleanup);

/*
 * Und gestellte Globale wieder abraeumen - `unstubGlobals` steht in der
 * Vitest-Voreinstellung auf `false`, also passiert es nur, wenn es jemand tut.
 * Betroffen ist bisher genau eines: das Geraet aus `test/board.ts`
 * (`asTouchDevice`). Bliebe es stehen, erbte jeder folgende Block derselben
 * Datei ein Handy, das er nie bestellt hat.
 */
afterEach(() => vi.unstubAllGlobals());

export {
  render,
  renderHook,
  screen,
  within,
  fireEvent,
  act,
  waitFor,
} from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
