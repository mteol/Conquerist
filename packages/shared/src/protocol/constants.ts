/**
 * Pfad, unter dem der WebSocket-Upgrade entgegengenommen wird.
 *
 * Liegt in `shared`, weil er Teil des Protokollvertrags ist: Server prueft ihn
 * im upgrade-Listener, Client haengt ihn an `location.host`. Zwei Konstanten
 * waeren zwei Wahrheiten.
 */
export const WS_PATH = '/ws';
