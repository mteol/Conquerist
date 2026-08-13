import {
  eventSchema,
  successMessage,
  type EventPayloadOf,
  type EventType,
} from '@conquerist/shared';

/**
 * Ereignisse verschicken - und vorher pruefen.
 *
 * Der Router validiert seit Etappe 0 jede Antwort gegen ihr Schema, mit genau
 * dieser Etappe als Begruendung: was nicht im Schema steht, kann den Server
 * nicht verlassen. Fuer Ereignisse gilt dasselbe, sie gehen nur nicht durch den
 * Router. Deshalb diese Schleuse.
 *
 * Ein ungueltiges Ereignis wird **nicht** gesendet. Lieber ein Spieler ohne
 * Aktualisierung und ein lauter Log-Eintrag als ein `rng` auf der Leitung.
 */
export interface EventSink {
  send<K extends EventType>(type: K, payload: EventPayloadOf<K>): void;
}

export function createEventSender(
  send: (raw: string) => void,
  onInvalid: (type: string, message: string) => void,
): EventSink {
  return {
    send(type, payload) {
      const parsed = eventSchema(type).safeParse(payload);
      if (!parsed.success) {
        onInvalid(type, parsed.error.issues.map((issue) => issue.message).join('; '));
        return;
      }

      send(JSON.stringify(successMessage(type, parsed.data)));
    },
  };
}
