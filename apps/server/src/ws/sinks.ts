import type { EventSink } from './events.js';

/**
 * Wer ist gerade wie erreichbar.
 *
 * Ein Spieler kann mehrere offene Verbindungen haben - zweiter Tab, Handy
 * daneben, ein Reload, dessen alte Verbindung noch nicht geschlossen ist.
 * Deshalb eine Liste je Nutzer und nicht eine Senke.
 *
 * Der Schluessel ist die `userId` und nicht die Verbindungs-Id: die Zustellung
 * fragt „was darf diese Person sehen", und das haengt an der Person.
 */
export class SinkHub {
  private readonly byUser = new Map<string, EventSink[]>();

  add(userId: string, sink: EventSink): void {
    const existing = this.byUser.get(userId);
    if (existing === undefined) {
      this.byUser.set(userId, [sink]);
      return;
    }
    if (!existing.includes(sink)) existing.push(sink);
  }

  remove(userId: string, sink: EventSink): void {
    const existing = this.byUser.get(userId);
    if (existing === undefined) return;

    const remaining = existing.filter((candidate) => candidate !== sink);
    if (remaining.length === 0) this.byUser.delete(userId);
    else this.byUser.set(userId, remaining);
  }

  /** Ob diese Person noch irgendwo offen ist - entscheidet ueber `connected`. */
  has(userId: string): boolean {
    return this.byUser.has(userId);
  }

  /** Die Form, die `broadcast*` erwartet. */
  get map(): ReadonlyMap<string, readonly EventSink[]> {
    return this.byUser;
  }
}
