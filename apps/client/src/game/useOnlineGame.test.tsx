// @vitest-environment jsdom
import type { JSX } from 'react';
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '../test/dom';
import type { SocketLike } from '../net/types';
import { useOnlineGame } from './useOnlineGame';

/**
 * Eine Attrappe statt eines echten Sockets.
 *
 * Der Transport programmiert seit Etappe 0 gegen `SocketLike`, damit Tests
 * ohne jsdom-WebSocket und ohne offenen Port auskommen. Hier wird das zum
 * ersten Mal fuer den Spielhaken genutzt: geprueft wird, was der Client aus
 * dem macht, was hereinkommt - nicht der Server.
 */
class FakeSocket implements SocketLike {
  readyState = 1;
  onopen: ((event: unknown) => void) | null = null;
  onclose: ((event: { readonly code: number; readonly reason: string }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onmessage: ((event: { readonly data: unknown }) => void) | null = null;

  readonly sent: { id: string; type: string; payload: unknown }[] = [];

  send(data: string): void {
    this.sent.push(JSON.parse(data));
  }

  close(): void {
    this.readyState = 3;
  }

  /** Beantwortet die letzte Anfrage dieses Typs so, wie der Server es taete. */
  reply(type: string, payload: unknown): void {
    const request = [...this.sent].reverse().find((message) => message.type === type);
    if (request === undefined) throw new Error(`Keine Anfrage vom Typ ${type}`);
    this.deliver({ type: `${type}.ok`, ok: true, replyTo: request.id, payload });
  }

  /** Eine Nachricht ohne Anfrage - so kommt der Raumstand herein. */
  event(type: string, payload: unknown): void {
    this.deliver({ type, ok: true, payload });
  }

  private deliver(message: unknown): void {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
}

const room = {
  code: 'K7X2',
  hostId: 'u1',
  seatCount: 3,
  seed: 'abc',
  started: false,
  seats: [{ userId: 'u1', name: 'Anna', color: '#c0392b', connected: true }],
};

let socket: FakeSocket;

function Probe(): JSX.Element {
  const online = useOnlineGame(null, {
    socketFactory: () => {
      socket = new FakeSocket();
      return socket;
    },
    observeEnvironment: false,
  });

  return (
    <div>
      <p data-testid="raum">{online.state.room === null ? 'kein Raum' : online.state.room.code}</p>
      <button
        type="button"
        onClick={() => {
          void online.leaveRoom();
        }}
      >
        Tisch verlassen
      </button>
    </div>
  );
}

async function connectedInRoom(): Promise<void> {
  render(<Probe />);

  await act(async () => {
    socket.onopen?.({});
  });
  await act(async () => {
    socket.reply('hello', { userId: 'u1', secret: 'geheim', name: 'Anna' });
  });
  await act(async () => {
    socket.event('room.state', room);
  });
}

describe('Online-Partie', () => {
  it('zeigt den Raum, sobald sein Stand hereinkommt', async () => {
    await connectedInRoom();
    expect(screen.getByTestId('raum').textContent).toBe('K7X2');
  });

  it('verlaesst den Tisch, obwohl danach kein Raumstand mehr kommt', async () => {
    await connectedInRoom();

    await act(async () => {
      screen.getByRole('button', { name: 'Tisch verlassen' }).click();
    });

    // Der Kern des Fehlers: wer den Tisch verlaesst, steht nicht mehr in
    // `seats` und bekommt deshalb kein `room.state` mehr. Der Client muss
    // seinen Raum also selbst loswerden, sonst klebt der Wartebereich fest.
    await act(async () => {
      socket.reply('room.leave', {});
    });

    expect(screen.getByTestId('raum').textContent).toBe('kein Raum');
  });
});
