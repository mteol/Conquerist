import { useState, type JSX } from 'react';
import type { GameState } from '@conquerist/shared';
import type { Seat } from './seats';
import { AccountDialog } from './dialogs/AccountDialog';
import { GameScreen } from './screens/GameScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { StartScreen, type LocalOptions } from './screens/StartScreen';
import { MenuScreen, type MenuChoice } from './screens/MenuScreen';
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
  readonly options: LocalOptions;
}

export function App(): JSX.Element {
  const [local, setLocal] = useState<LocalSession | null>(null);

  return local === null ? (
    <Online onStartLocal={(game, seats, options) => setLocal({ game, seats, options })} />
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
      concealBetweenTurns={session.options.concealBetweenTurns}
      onLeave={onLeave}
    />
  );
}

function Online({
  onStartLocal,
}: {
  readonly onStartLocal: (game: GameState, seats: readonly Seat[], options: LocalOptions) => void;
}): JSX.Element {
  const online = useOnlineGame(roomFromLocation());
  const { room, view } = online.state;

  /*
   * Welcher Weg gewaehlt wurde. `null` heisst: das Hauptmenue steht.
   *
   * Ein Einladungslink ueberspringt es - wer ihm gefolgt ist, hat seine
   * Entscheidung schon getroffen, und ein Menue davor waere eine Huerde
   * zwischen Klick und Tisch.
   */
  const [choice, setChoice] = useState<Exclude<MenuChoice, 'resume'> | null>(
    roomFromLocation() === null ? null : 'join',
  );

  /*
   * Der Konto-Dialog: welcher Modus (oder keiner) und die Absage des Servers,
   * falls es eine gab.
   *
   * Beide leben hier und nicht in `MenuScreen`/`StartScreen`, weil beide
   * Bildschirme dieselbe Konto-Ecke tragen und derselbe Dialog fuer beide
   * gilt - ein Zustand, zwei Aufrufer.
   */
  const [account, setAccount] = useState<'register' | 'login' | null>(null);
  const [accountProblem, setAccountProblem] = useState<string | null>(null);

  const openAccount = (mode: 'register' | 'login'): void => {
    setAccountProblem(null);
    setAccount(mode);
  };

  const submitAccount = async (input: {
    login: string;
    password: string;
    email?: string;
    confirmAbandonGuest?: boolean;
  }): Promise<void> => {
    try {
      if (account === 'register') {
        await online.register(input);
      } else {
        await online.login(input);
      }
      setAccount(null);
      setAccountProblem(null);
    } catch (error) {
      // Der Dialog bleibt offen, sonst ist die Meldung weg, bevor jemand sie
      // liest - erst ein zweiter Versuch oder „Abbrechen" raeumt ihn weg.
      setAccountProblem(error instanceof Error ? error.message : 'Unbekannter Fehler');
    }
  };

  const accountDialog =
    account === null ? null : (
      <AccountDialog
        mode={account}
        openGuestGames={online.myRooms.length}
        problem={accountProblem}
        onSubmit={(input) => {
          void submitAccount(input);
        }}
        onClose={() => {
          setAccount(null);
          setAccountProblem(null);
        }}
      />
    );

  let screen: JSX.Element;

  if (room === null && choice === null) {
    screen = (
      <MenuScreen
        openGames={online.myRooms.length}
        onChoose={(next) => {
          // „Weiterspielen" ist kein eigener Bildschirm: die Liste steht auf
          // dem Startbildschirm, und dorthin fuehrt sie.
          setChoice(next === 'resume' ? 'online' : next);
        }}
        identity={online.identity}
        onRegister={() => openAccount('register')}
        onLogin={() => openAccount('login')}
        onLogout={() => {
          void online.logout();
        }}
      />
    );
  } else if (room === null) {
    screen = (
      <StartScreen
        mode={choice ?? 'all'}
        onBack={() => setChoice(null)}
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
        myRooms={online.myRooms}
        onResume={(code) => {
          // Kein eigener Einstiegsweg: `room.join` erkennt einen bekannten Sitz
          // seit Etappe 4 wieder. Ein zweiter waere ein zweiter Weg fuer
          // dieselbe Sache.
          void online.joinRoom(code, loadName() ?? '');
        }}
        identity={online.identity}
        onRegister={() => openAccount('register')}
        onLogin={() => openAccount('login')}
        onLogout={() => {
          void online.logout();
        }}
      />
    );
  } else if (!room.started || view === null) {
    screen = (
      <LobbyScreen
        room={room}
        youId={online.userId ?? ''}
        onStart={() => {
          void online.startGame();
        }}
        onLeave={() => {
          void online.leaveRoom();
        }}
        onConfigure={(seatCount, seed) => {
          void online.configureRoom(seatCount, seed);
        }}
      />
    );
  } else {
    screen = (
      <GameScreen
        view={view}
        actions={online.state.actions}
        log={online.state.log}
        error={online.state.lastError}
        onAct={(action) => {
          void online.act(action);
        }}
        onDismissError={online.dismissError}
        offline={online.connection.status !== 'open'}
        onLeave={() => {
          void online.leaveRoom();
        }}
      />
    );
  }

  return (
    <>
      {screen}
      {accountDialog}
    </>
  );
}
