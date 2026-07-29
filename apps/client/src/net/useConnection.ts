import { useCallback, useEffect, useRef, useState } from 'react';
import type { MessageType, RequestOf, ResponseOf } from '@conquerist/shared';
import { NotConnectedError, Transport } from './transport';
import type { TransportOptions } from './transport';
import type { ConnectionState } from './types';

/**
 * React-Hook um `transport.ts`.
 *
 * Die gesamte Netzwerklogik steckt im Transport; dieser Hook macht nichts
 * weiter, als dessen Lebenszyklus an die Komponente zu binden und den Zustand
 * in React-State zu spiegeln.
 */

const INITIAL_STATE: ConnectionState = {
  status: 'connecting',
  attempt: 0,
  nextRetryAt: null,
  rttMs: null,
  clockOffsetMs: null,
  lastError: null,
};

export interface UseConnectionResult {
  readonly state: ConnectionState;
  readonly send: <K extends MessageType>(type: K, payload: RequestOf<K>) => Promise<ResponseOf<K>>;
  /** Beste Schaetzung der Server-Uhr, `null` bevor ein Pong angekommen ist. */
  readonly serverNow: () => number | null;
  /** Wartet nicht auf den Backoff, sondern versucht es sofort. */
  readonly reconnectNow: () => void;
}

export function useConnection(options: TransportOptions = {}): UseConnectionResult {
  // Die Optionen sollen den Transport nicht neu aufbauen, wenn der Aufrufer ein
  // frisches Objektliteral uebergibt. Der Transport entsteht genau einmal.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [transport, setTransport] = useState<Transport | null>(null);
  const [state, setState] = useState<ConnectionState>(INITIAL_STATE);

  useEffect(() => {
    /**
     * Instanz im Effect erzeugen, nicht im Render. Unter StrictMode laeuft der
     * Effect in der Entwicklung zweimal - Aufbau und Abbau muessen also
     * vollstaendig symmetrisch sein, sonst bleibt beim ersten Durchlauf ein
     * Socket samt Timern zurueck.
     */
    const instance = new Transport(optionsRef.current);
    setTransport(instance);

    const unsubscribe = instance.subscribe(setState);
    instance.connect();

    return () => {
      unsubscribe();
      instance.dispose();
      setTransport(null);
    };
  }, []);

  const send = useCallback(
    async <K extends MessageType>(type: K, payload: RequestOf<K>): Promise<ResponseOf<K>> => {
      if (transport === null) throw new NotConnectedError();
      return transport.send(type, payload);
    },
    [transport],
  );

  const serverNow = useCallback((): number | null => transport?.serverNow() ?? null, [transport]);

  const reconnectNow = useCallback((): void => {
    transport?.connect();
  }, [transport]);

  return { state, send, serverNow, reconnectNow };
}
