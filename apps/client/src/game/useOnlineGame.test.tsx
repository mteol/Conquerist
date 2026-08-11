// @vitest-environment jsdom
import type { JSX } from 'react';
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { AUTH_LOGIN, AUTH_LOGOUT, AUTH_REGISTER, HELLO, MY_ROOMS } from '@conquerist/shared';
import { render, screen } from '../test/dom';
import { loadSecret } from '../net/session';
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

  /** Lehnt die n-te Anfrage dieses Typs ab, so wie der Server es taete. */
  refuse(type: string, message: string, index = 0): void {
    const request = this.sent.filter((entry) => entry.type === type)[index];
    if (request === undefined) throw new Error(`Keine ${index + 1}. Anfrage vom Typ ${type}`);
    this.deliver({
      type: 'error',
      ok: false,
      replyTo: request.id,
      error: { code: 'REJECTED', message },
    });
  }

  /** Wie oft dieser Typ geschickt wurde. */
  countOf(type: string): number {
    return this.sent.filter((entry) => entry.type === type).length;
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
      <p data-testid="gast">
        {online.identity === null ? 'unbekannt' : String(online.identity.isGuest)}
      </p>
      <p data-testid="login">{online.identity?.login ?? 'kein Login'}</p>
      <button
        type="button"
        onClick={() => {
          void online.leaveRoom();
        }}
      >
        Tisch verlassen
      </button>
      <button
        type="button"
        onClick={() => {
          void online.login({ login: 'anna', password: 'langgenug1' });
        }}
      >
        Anmelden
      </button>
      <button
        type="button"
        onClick={() => {
          void online.register({ login: 'bob', password: 'langgenug1' });
        }}
      >
        Registrieren
      </button>
      <button
        type="button"
        onClick={() => {
          void online.logout();
        }}
      >
        Abmelden
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

  it('wirft ein Geheimnis weg, das der Server nicht kennt, und meldet sich neu an', async () => {
    // Genau der Fall nach einem Datenbankwechsel: der Browser haelt ein
    // Geheimnis, das es serverseitig nicht mehr gibt.
    window.localStorage.setItem('conquerist.secret', 'aus-einer-alten-datenbank');

    render(<Probe />);
    await act(async () => {
      socket.onopen?.({});
    });

    await act(async () => {
      socket.refuse('hello', 'Dieses Sitzungsgeheimnis kennt der Server nicht');
    });

    // Ohne diesen zweiten Versuch bliebe der Browser dauerhaft ausgesperrt.
    expect(socket.countOf('hello')).toBe(2);
    expect(window.localStorage.getItem('conquerist.secret')).toBeNull();

    await act(async () => {
      socket.reply('hello', { userId: 'u1', secret: 'frisch', name: 'Anna' });
    });
    await act(async () => {
      socket.reply('room.mine', { rooms: [] });
    });

    expect(window.localStorage.getItem('conquerist.secret')).toBe('frisch');
  });

  it('merkt sich die Identitaet aus hello und gibt sie heraus', async () => {
    render(<Probe />);

    await act(async () => {
      socket.onopen?.({});
    });
    await act(async () => {
      socket.reply(HELLO, { userId: 'u1', name: 'Gast', isGuest: true });
    });

    expect(screen.getByTestId('gast').textContent).toBe('true');
  });

  it('legt das neue Geheimnis nach dem Anmelden ab', async () => {
    render(<Probe />);

    await act(async () => {
      socket.onopen?.({});
    });
    await act(async () => {
      socket.reply(HELLO, { userId: 'u1', name: 'Gast', isGuest: true });
    });

    await act(async () => {
      screen.getByRole('button', { name: 'Anmelden' }).click();
    });
    await act(async () => {
      socket.reply(AUTH_LOGIN, {
        userId: 'u2',
        name: 'Anna',
        isGuest: false,
        login: 'anna',
        secret: 'neu',
      });
    });

    expect(loadSecret()).toBe('neu');
    expect(screen.getByTestId('login').textContent).toBe('anna');
    expect(socket.sent).toContainEqual(
      expect.objectContaining({
        type: AUTH_LOGIN,
        payload: { login: 'anna', password: 'langgenug1' },
      }),
    );
  });

  it('legt ein Konto an und holt danach die Partienliste neu', async () => {
    render(<Probe />);

    await act(async () => {
      socket.onopen?.({});
    });
    await act(async () => {
      socket.reply(HELLO, { userId: 'u1', name: 'Gast', isGuest: true });
    });
    const roomsBefore = socket.countOf(MY_ROOMS);

    await act(async () => {
      screen.getByRole('button', { name: 'Registrieren' }).click();
    });
    await act(async () => {
      socket.reply(AUTH_REGISTER, {
        userId: 'u2',
        name: 'Bob',
        isGuest: false,
        login: 'bob',
        secret: 'neu',
      });
    });

    expect(screen.getByTestId('login').textContent).toBe('bob');
    expect(socket.sent).toContainEqual(
      expect.objectContaining({
        type: AUTH_REGISTER,
        payload: { login: 'bob', password: 'langgenug1' },
      }),
    );
    // Die Kontoerstellung schickt genau eine `auth.register`-Anfrage - eine
    // vertauschte Konstante (etwa `AUTH_LOGIN`) faende diese Antwort nicht.
    expect(socket.countOf(AUTH_REGISTER)).toBe(1);
    expect(socket.countOf(MY_ROOMS)).toBe(roomsBefore + 1);
  });

  it('meldet ab, schickt ein leeres Payload und holt danach die Partienliste neu', async () => {
    await connectedInRoom();
    const roomsBefore = socket.countOf(MY_ROOMS);

    await act(async () => {
      screen.getByRole('button', { name: 'Abmelden' }).click();
    });
    await act(async () => {
      socket.reply(AUTH_LOGOUT, { userId: 'u3', name: 'Gast', isGuest: true });
    });

    expect(screen.getByTestId('gast').textContent).toBe('true');
    expect(socket.sent).toContainEqual(expect.objectContaining({ type: AUTH_LOGOUT, payload: {} }));
    expect(socket.countOf(MY_ROOMS)).toBe(roomsBefore + 1);
  });

  it('behaelt das alte Geheimnis, wenn die Anmeldung keins zurueckgibt', async () => {
    // Ein wiederkehrendes Geraet: das Geheimnis ist schon da, der Server
    // erkennt die Sitzung und schickt kein neues.
    window.localStorage.setItem('conquerist.secret', 'alt');

    render(<Probe />);
    await act(async () => {
      socket.onopen?.({});
    });
    await act(async () => {
      socket.reply(HELLO, { userId: 'u1', name: 'Gast', isGuest: true });
    });

    await act(async () => {
      screen.getByRole('button', { name: 'Anmelden' }).click();
    });
    await act(async () => {
      socket.reply(AUTH_LOGIN, { userId: 'u1', name: 'Anna', isGuest: false, login: 'anna' });
    });

    expect(screen.getByTestId('login').textContent).toBe('anna');
    expect(loadSecret()).toBe('alt');
  });
});
