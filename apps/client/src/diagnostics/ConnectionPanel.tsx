import { useCallback, useEffect, useState } from 'react';
import type { JSX } from 'react';
import { PING } from '@conquerist/shared';
import { useConnection } from '../net/useConnection';
import type { ConnectionStatus } from '../net/types';

/**
 * Die Diagnoseseite aus Etappe 0 - unveraendert, nur umgezogen.
 *
 * Sie sitzt jetzt in einem zugeklappten Feld auf dem Startbildschirm. Das ist
 * kein Schoenheitsgrund: `useConnection` laeuft nur, wenn diese Komponente
 * gerendert wird, und damit baut eine Hotseat-Partie gar keine
 * WebSocket-Verbindung auf. Etappe 5 knuepft hier wieder an.
 */

interface PingResult {
  readonly roundTripMs: number;
  readonly serverTime: number;
}

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  connecting: 'Verbinde',
  open: 'Verbunden',
  reconnecting: 'Verbindung verloren',
  closed: 'Getrennt',
};

export function ConnectionPanel(): JSX.Element {
  const { state, send, serverNow, reconnectNow } = useConnection();

  const [result, setResult] = useState<PingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isOpen = state.status === 'open';

  const sendPing = useCallback(async () => {
    setBusy(true);
    setError(null);

    const startedAt = performance.now();
    try {
      const pong = await send(PING, {});
      setResult({
        roundTripMs: Math.round(performance.now() - startedAt),
        serverTime: pong.serverTime,
      });
    } catch (cause) {
      setResult(null);
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }, [send]);

  return (
    <>
      <div className="status">
        <span className={`status__dot status__dot--${state.status}`} aria-hidden="true" />
        <span className="status__label">{STATUS_LABEL[state.status]}</span>
        {state.status === 'reconnecting' ? (
          <RetryHint nextRetryAt={state.nextRetryAt} attempt={state.attempt} />
        ) : null}
      </div>

      {state.status === 'reconnecting' ? (
        <button className="button button--ghost" type="button" onClick={reconnectNow}>
          Jetzt versuchen
        </button>
      ) : null}

      {state.lastError !== null && !isOpen ? (
        <p className="hint">Letzter Grund: {state.lastError}</p>
      ) : null}

      <button
        className="button"
        type="button"
        onClick={() => void sendPing()}
        disabled={!isOpen || busy}
      >
        {busy ? 'Ping läuft…' : 'Ping senden'}
      </button>

      {error !== null ? <p className="error">{error}</p> : null}

      {result !== null ? (
        <dl className="metrics">
          <Metric label="Antwort" value="pong" />
          <Metric label="Round-Trip" value={`${result.roundTripMs} ms`} />
          <Metric label="Server-Zeitstempel" value={formatTime(result.serverTime)} />
        </dl>
      ) : null}

      <dl className="metrics">
        <Metric label="RTT (gemessen)" value={state.rttMs === null ? '–' : `${state.rttMs} ms`} />
        <Metric
          label="Uhrenversatz"
          value={state.clockOffsetMs === null ? '–' : `${signed(state.clockOffsetMs)} ms`}
        />
        <Metric label="Server-Uhr" value={formatOptionalTime(serverNow())} />
        <Metric label="Fehlversuche" value={String(state.attempt)} />
      </dl>

      <p className="hint">
        Der Client haelt die Verbindung selbst nach: bleibt es 20&nbsp;Sekunden still, schickt er
        einen Ping. Antwortet der nicht, gilt die Verbindung als tot und wird neu aufgebaut.
      </p>
    </>
  );
}

function Metric({ label, value }: { readonly label: string; readonly value: string }): JSX.Element {
  return (
    <div className="metrics__row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/** Zaehlt die Sekunden bis zum naechsten Versuch herunter. */
function RetryHint({
  nextRetryAt,
  attempt,
}: {
  readonly nextRetryAt: number | null;
  readonly attempt: number;
}): JSX.Element | null {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (nextRetryAt === null) {
      setSecondsLeft(null);
      return;
    }

    const update = (): void => {
      setSecondsLeft(Math.max(0, Math.ceil((nextRetryAt - Date.now()) / 1000)));
    };

    update();
    const timer = setInterval(update, 250);
    return () => {
      clearInterval(timer);
    };
  }, [nextRetryAt]);

  if (secondsLeft === null) return null;

  return (
    <span className="status__hint">
      neuer Versuch in {secondsLeft}s &middot; Versuch {attempt}
    </span>
  );
}

function signed(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}

function formatTime(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString('de-DE', { hour12: false });
}

function formatOptionalTime(epochMs: number | null): string {
  return epochMs === null ? '–' : formatTime(epochMs);
}
