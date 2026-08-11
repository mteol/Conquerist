import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Wie im Dev-Server: gegen die shared-Quelle testen, nicht gegen dist.
    conditions: ['development', 'module', 'node', 'import', 'default'],
  },
  test: {
    /**
     * `node` als Voreinstellung. `src/net` ist bewusst framework- und DOM-frei
     * (Fake-Socket-Factory, Zugriff auf `window`/`document` nur ueber Guards),
     * und die reinen Module aus Etappe 3 - Layout, Klickkarten, Anzeigemodell,
     * Verlauf, Hotseat-Zustand - brauchen ebenfalls keinen DOM. Ohne jsdom
     * laufen sie spuerbar schneller.
     *
     * Die wenigen Dateien, die wirklich rendern, schalten sich einzeln um: mit
     * `// @vitest-environment jsdom` in der ersten Zeile. Eine Umgebungswahl je
     * Datei ist ehrlicher als eine Musterliste in dieser Konfiguration, die mit
     * jedem neuen Verzeichnis nachgepflegt werden will.
     */
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    css: {
      /**
       * Vitest stubbt CSS-Importe sonst als leeres Modul - schneller, aber ein
       * `?raw`-Import liefert dann nichts. `AccountCorner.test.tsx` braucht den
       * echten Text von `index.css`, um zu pruefen, dass die
       * Schmale-Fenster-Regeln tatsaechlich dort stehen (jsdom wertet keine
       * Media Query aus, das CSS selbst ist die einzig pruefbare Quelle).
       *
       * Eng gefasst auf genau dieses Muster - jeder andere CSS-Import (etwa
       * `main.tsx`s `./index.css` fuer die Anwendung selbst) bleibt gestubbt,
       * unveraendertes Verhalten fuer den Rest der Tests.
       */
      include: [/\.css\?raw$/],
    },
  },
});
