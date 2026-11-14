import { describe, expect, it } from 'vitest';
import index from '../index.css?raw';
import { STYLESHEET_PARTS } from './stylesheet';

describe('stylesheet', () => {
  it('liest genau die Dateien, die index.css importiert, in derselben Reihenfolge', () => {
    const imported = [...index.matchAll(/styles\/([a-z-]+)\.css/g)].map((m) => m[1]);
    expect(imported.length).toBeGreaterThan(0);
    expect(STYLESHEET_PARTS.map(([name]) => name)).toEqual(imported);
  });

  it('liefert keine leere Datei', () => {
    for (const [name, text] of STYLESHEET_PARTS) {
      expect(text.length, name).toBeGreaterThan(0);
    }
  });
});
