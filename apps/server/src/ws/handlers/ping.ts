import { PING } from '@conquerist/shared';
import type { MessageRouter } from '../router.js';

/**
 * Handler fuer die ANWENDUNGSNACHRICHT "ping" (nicht der Protokoll-Heartbeat,
 * siehe ws/heartbeat.ts).
 *
 * `Date.now()` ist hier zulaessig: das ist Transportcode. Die Purity-Regel aus
 * CLAUDE.md (Regel 2) gilt fuer die Spiellogik in `shared` - dort kommt Zeit ab
 * Etappe 2 ausschliesslich als Parameter herein.
 */
export function registerPingHandler(router: MessageRouter, now: () => number = Date.now): void {
  router.register(PING, () => ({ serverTime: now() }));
}
