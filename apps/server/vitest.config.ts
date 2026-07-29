import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Die Tests laufen gegen die shared-QUELLE, nicht gegen dist. Sonst testet man
  // nach einer shared-Aenderung stillschweigend den alten Build.
  resolve: {
    conditions: ['development', 'node', 'import', 'default'],
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
