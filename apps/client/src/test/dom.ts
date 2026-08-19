import { afterEach } from 'vitest';
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

export { render, screen, within, fireEvent, act } from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
