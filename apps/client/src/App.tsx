import { useState, type JSX } from 'react';
import type { GameState } from '@conquerist/shared';
import type { Seat } from './seats';
import { GameScreen } from './screens/GameScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { StartScreen } from './screens/StartScreen';
import { useLocalGame } from './game/useLocalGame';
import { useOnlineGame } from './game/useOnlineGame';
import { loadName, roomFromLocation } from './net/session';

/**
 * Welcher Bildschirm gilt.
 *
 * Die Reihenfolge der Abfragen ist die Antwort: eine **lokale** Partie schlaegt
 * alles, weil sie ohne Netz laeuft und niemanden etwas angeht. Sonst
 * entscheidet der Serverstand - kein Raum heisst Start, Raum ohne Partie heisst
 * Wartebereich, Raum mit Partie heisst Spiel. Der Client entscheidet damit
 * nicht selbst, wo er ist; er liest es ab.
 *
 * Kein Router. Die einzige Adresse, die jemand teilt, ist der Einladungslink,
 * und der traegt seinen Raum in `?raum=`. Dafuer ist eine Bibliothek zu viel.
 */
interface LocalSession {
  readonly game: GameState;
  readonly seats: readonly Seat[];
}

export function App(): JSX.Element {
  const [local, setLocal] = useState<LocalSession | null>(null);

  return local === null ? (
    <Online onStartLocal={(game, seats) => setLocal({ game, seats })} />
  ) : (
    <Local session={local} onLeave={() => setLocal(null)} />
  );
}

/**
 * Die lokale Partie als eigene Komponente.
 *
 * Nicht der Uebersicht wegen, sondern weil `useLocalGame` einen Zustand
 * braucht: ein Haken, der nur manchmal laufen soll, ist keiner. Solange keine
 * lokale Partie laeuft, existiert diese Komponente nicht - und damit auch ihr
 * Zustand nicht.
 */
function Local({
  session,
  onLeave,
}: {
  readonly session: LocalSession;
  readonly onLeave: () => void;
}): JSX.Element {
  const game = useLocalGame(session.game, session.seats);

  return (
    <GameScreen
      view={game.view}
      actions={game.actions}
      log={game.log}
      error={game.error}
      onAct={game.act}
      onDismissError={game.dismissError}
      onLeave={onLeave}
    />
  );
}

function Online({
  onStartLocal,
}: {
  readonly onStartLocal: (game: GameState, seats: readonly Seat[]) => void;
}): JSX.Element {
  const online = useOnlineGame(roomFromLocation());
  const { room, view } = online.state;

  if (room === null) {
    return (
      <StartScreen
        onStartLocal={onStartLocal}
        onCreateRoom={(seatCount, seed, name) => {
          void online.createRoom(seatCount, seed, name);
        }}
        onJoinRoom={(code, name) => {
          void online.joinRoom(code, name);
        }}
        initialCode={roomFromLocation()}
        initialName={loadName() ?? ''}
        problem={online.state.lastError}
      />
    );
  }

  if (!room.started || view === null) {
    return (
      <LobbyScreen
        room={room}
        youId={online.userId ?? ''}
        onStart={() => {
          void online.startGame();
        }}
        onLeave={() => {
          void online.leaveRoom();
        }}
      />
    );
  }

  return (
    <GameScreen
      view={view}
      actions={online.state.actions}
      log={online.state.log}
      error={online.state.lastError}
      onAct={(action) => {
        void online.act(action);
      }}
      onDismissError={online.dismissError}
      onLeave={() => {
        void online.leaveRoom();
      }}
    />
  );
}
