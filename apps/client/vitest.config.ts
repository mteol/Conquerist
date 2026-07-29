import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Wie im Dev-Server: gegen die shared-Quelle testen, nicht gegen dist.
    conditions: ['development', 'module', 'node', 'import', 'default'],
  },
  test: {
    /**
     * `node`, nicht jsdom. Getestet wird `src/net`, und das ist bewusst
     * framework- und DOM-frei: der Transport bekommt eine Fake-Socket-Factory
     * injiziert und greift auf `window`/`document` nur ueber Guards zu.
     * Kein jsdom heisst: schnelle Tests und kein Verlass auf Browser-Emulation.
     */
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
