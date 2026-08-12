import type { GameAction, GameEvent, OverEvent, PlayerView, RoomEvent } from '@conquerist/shared';
import type { LogEntry } from './hotseat';

/**
 * Was mit einem eintreffenden Ereignis passiert - als reine Funktion.
 *
 * Die wichtigste Regel steht in drei Zeilen: **ein Stand mit kleinerer
 * `version` wird verworfen.** Nach einem Reconnect schickt der Server erst den
 * Raum, dann den Spielstand, und dazwischen kann ein Zug liegen; ohne diese
 * Regel wuerde die Oberflaeche kurz zurueckspringen.
 *
 * Rein und ohne React, damit genau das ohne gerenderte Komponente pruefbar ist.
 * Der Haken darueber ist nur noch Verdrahtung - dieselbe Aufteilung wie beim
 * Hotseat aus Etappe 3.
 */
export interface OnlineState {
  /** Der Wartebereich. `null`, solange man in keinem Raum sitzt. */
  readonly room: RoomEvent | null;
  /** Die eigene Sicht auf die Partie. `null`, solange sie nicht laeuft. */
  readonly view: PlayerView | null;
  /** Was ich gerade tun darf - vom Server ausgerechnet, nicht hier. */
  readonly actions: readonly GameAction[];
  readonly log: readonly LogEntry[];
  /** Der letzte Ablehnungsgrund - sichtbar, bis er weggeraeumt wird. */
  readonly lastError: string | null;
  /** Gesetzt, wenn der Server die Partie beendet hat. */
  readonly over: OverEvent | null;
  /**
   * Serveruhr minus eigene Uhr, aus `sentAt` des letzten Standes.
   *
   * Fristen stehen als Serverzeit im Zustand. Ohne diesen Versatz zeigte eine
   * um zwei Minuten falsch gehende Rechneruhr eine Frist, die laengst
   * abgelaufen ist - oder eine, die nie endet.
   */
  readonly clockOffset: number;
}

export const emptyOnlineState: OnlineState = {
  room: null,
  view: null,
  actions: [],
  log: [],
  lastError: null,
  over: null,
  clockOffset: 0,
};

export type OnlineEvent =
  | { readonly type: 'room'; readonly payload: RoomEvent }
  | { readonly type: 'game'; readonly payload: GameEvent }
  | { readonly type: 'over'; readonly payload: OverEvent }
  | { readonly type: 'error'; readonly message: string }
  | { readonly type: 'dismissError' }
  /** Verbindung weg: der Stand bleibt stehen, aber nichts ist mehr anklickbar. */
  | { readonly type: 'disconnected' }
  /**
   * Tisch verlassen - und zwar auf eigenen Wunsch.
   *
   * Der einzige Uebergang, den der Client selbst ausloest. Er muss es auch:
   * wer nicht mehr in `seats` steht, bekommt kein `room.state` mehr, weil
   * zugestellt wird, wer am Tisch sitzt. Ohne diesen Fall bliebe der
   * Wartebereich stehen, obwohl der Server den Platz laengst freigegeben hat.
   */
  | { readonly type: 'left' };

export function onlineReducer(state: OnlineState, event: OnlineEvent): OnlineState {
  switch (event.type) {
    case 'room':
      return { ...state, room: event.payload };

    case 'game': {
      // Der aeltere Stand wird nicht nur ignoriert, es wird auch dasselbe
      // Objekt zurueckgegeben - React rendert dann gar nicht erst neu.
      if (state.view !== null && event.payload.version <= state.view.version) return state;

      const entry = event.payload.entry;
      return {
        ...state,
        view: event.payload.view,
        actions: event.payload.actions,
        // Je Stand neu gerechnet: eine Uhr, die nachgeht, holt damit auf.
        clockOffset: event.payload.sentAt - Date.now(),
        log:
          entry === undefined
            ? state.log
            : [...state.log, { turn: event.payload.view.turn, text: entry }],
      };
    }

    case 'over':
      return { ...state, over: event.payload, actions: [] };

    case 'error':
      return { ...state, lastError: event.message };

    case 'dismissError':
      return state.lastError === null ? state : { ...state, lastError: null };

    case 'disconnected':
      return state.actions.length === 0 ? state : { ...state, actions: [] };

    case 'left':
      // Vollstaendig zurueck auf Anfang: Raum, Sicht, Zuege und Verlauf
      // gehoerten alle zu einem Tisch, an dem man nicht mehr sitzt.
      return emptyOnlineState;
  }
}
