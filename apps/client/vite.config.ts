import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { WS_PATH } from '@conquerist/shared';

const SERVER_TARGET = 'ws://127.0.0.1:8080';

export default defineConfig({
  plugins: [react()],

  resolve: {
    /**
     * `development` zuerst: damit greift die entsprechende Condition in der
     * exports-Map von @conquerist/shared und Vite laedt die TypeScript-QUELLE
     * statt packages/shared/dist. Eine Aenderung in shared ist damit sofort im
     * Browser, ohne Rebuild und ohne die klassische Stunde Fehlersuche an einem
     * veralteten dist.
     *
     * Die Vite-Defaults muessen mitgeschrieben werden, weil diese Option sie
     * ersetzt und nicht ergaenzt.
     */
    conditions: ['development', 'module', 'browser', 'import', 'default'],
  },

  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      /**
       * Der Client verbindet auf `location.host` und kennt keine Portnummer.
       * Vite nimmt den Upgrade auf 5173 an und leitet ihn nach 8080 weiter.
       *
       * `ws: true` ist zwingend - ohne das behandelt der Proxy den Request als
       * normales HTTP und der Upgrade schlaegt fehl.
       *
       * `changeOrigin` bleibt aus: der Origin-Header des Browsers
       * (http://localhost:5173) soll unveraendert beim Server ankommen, denn
       * genau den prueft dessen upgrade-Listener.
       */
      [WS_PATH]: {
        target: SERVER_TARGET,
        ws: true,
        changeOrigin: false,
      },
    },
  },

  build: {
    // Fuer den Produktionsbuild greift die default-Condition, also
    // packages/shared/dist. "pnpm build" baut shared per Topologie vorher.
    outDir: 'dist',
    sourcemap: true,
  },
});
