import { useState, type JSX } from 'react';
import type { GameState } from '@conquerist/shared';
import type { Seat } from './seats';
import { AudioProvider, useCueSound } from './audio/useAudio';
import { AccountDialog } from './dialogs/AccountDialog';
import { GameScreen } from './screens/GameScreen';
import { SettingsButton } from './screens/SettingsButton';
import { LobbyScreen } from './screens/LobbyScreen';
import { MenuScreen } from './screens/MenuScreen';
import { StartScreen, randomSeed, type Way } from './screens/StartScreen';
import { MIN_SEATS } from './seats';
import { useLocalGame } from './game/useLocalGame';
import { useOnlineGame } from './game/useOnlineGame';
import { useSettledRoll } from './game/useSettledRoll';
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
 *
 * **Der Titelbildschirm ist zurueck, und damit der vierte Zustand.** Er war
 * gestrichen worden, weil er genau eine Frage stellte - welcher Weg - und der
 * Bildschirm dahinter sie als Ueberschrift noch einmal vortrug. Seither hat der
 * Wartebereich sein Brett bekommen, und damit sahen Einrichtung und
 * Wartebereich gleich aus: links ein Panel, rechts das Brett. Ein Eingang, der
 * aussieht wie die Flaeche dahinter, ist kein Eingang.
 *
 * Die alte Doppelung kommt nicht mit zurueck: die Einrichtung traegt keine
 * Ueberschrift mehr, die den gewaehlten Weg wiederholt. Ihre Reiterreihe ist
 * kein Vortrag der Antwort, sondern das Bedienelement, mit dem man sie aendert,
 * ohne zurueckzugehen.
 *
 * `way === null` heisst Titel, sonst Einrichtung. Der Zustand steht hier und
 * nicht im `StartScreen`, weil er entscheidet, **welcher Bildschirm** gilt -
 * und das ist genau die Frage, die diese Datei beantwortet.
 */
interface LocalSession {
  readonly game: GameState;
  readonly seats: readonly Seat[];
}

export function App(): JSX.Element {
  const [local, setLocal] = useState<LocalSession | null>(null);

  /*
   * Der Ton umschliesst beide Wege, das Zahnrad steht daneben.
   *
   * Beides gehoert hierhin und nicht in die Bildschirme: die Lautstaerke gilt
   * ueberall, und ein Bedienelement, das je Bildschirm eingebaut wird, sitzt
   * am Ende an drei Stellen leicht verschieden.
   */
  return (
    <AudioProvider>
      {local === null ? (
        <Online onStartLocal={(game, seats) => setLocal({ game, seats })} />
      ) : (
        <Local session={local} onLeave={() => setLocal(null)} />
      )}
      <SettingsButton />
    </AudioProvider>
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
  /*
   * `useSettledRoll` liegt **um** die Partie und nicht in ihr: es haelt die
   * Vorfuehrung an, waehrend die Wuerfel fliegen, und dazu gehoert der Klang.
   * Stuende `useCueSound` davor, kaeme der Wurf zu hoeren, bevor er liegt.
   */
  const game = useSettledRoll(useLocalGame(session.game, session.seats));
  useCueSound(game.sound);

  return (
    <GameScreen
      view={game.view}
      actions={game.actions}
      log={game.log}
      error={game.error}
      landing={game.landing}
      onAct={game.act}
      onDismissError={game.dismissError}
      /*
       * Am geteilten Geraet ist die Hand immer zugedeckt.
       *
       * Es war einmal eine Wahl vor der Partie (`LocalOptions`), und sie ist
       * gefallen: zugedeckt war ohnehin die Vorgabe, und sie ist dieselbe
       * Regel, nach der online gespielt wird - Handkarten sind geheim
       * (Regel 4). Wer nebeneinander sitzt und sowieso alles sieht, drueckt
       * einmal mehr auf „Karten ansehen"; das ist ein Klick, wo vorher eine
       * Frage vor der Partie stand.
       */
      concealBetweenTurns
      onLeave={onLeave}
    />
  );
}

function Online({
  onStartLocal,
}: {
  readonly onStartLocal: (game: GameState, seats: readonly Seat[]) => void;
}): JSX.Element {
  const online = useOnlineGame();
  /*
   * Derselbe Haken wie in der lokalen Partie - und aus demselben Grund. Online
   * wartet damit **jeder** Bildschirm auf die Landung, auch der des Mitspielers,
   * der nur zusieht: der Wurf ist fuer alle derselbe Augenblick.
   */
  const shown = useSettledRoll(online.state);
  const { room } = online.state;
  const view = shown.view;

  useCueSound(shown.sound);

  /*
   * Der Konto-Dialog: welcher Modus (oder keiner) und die Absage des Servers,
   * falls es eine gab.
   *
   * Beide leben hier und nicht im `StartScreen`, weil der Dialog ueber dem
   * Bildschirm liegt und nicht in ihm: er wird auch dann noch angezeigt, wenn
   * darunter laengst der Wartebereich steht.
   */
  const [account, setAccount] = useState<'register' | 'login' | null>(null);
  const [accountProblem, setAccountProblem] = useState<string | null>(null);

  /*
   * Welcher Weg gewaehlt ist - `null` heisst: der Titel steht noch.
   *
   * **Ein Einladungslink ueberspringt den Titel.** Wer ihm gefolgt ist, hat
   * bereits entschieden; ihn vor eine Auswahl zu stellen, deren Antwort er
   * schon mitgebracht hat, waere genau die Doppelung, wegen der der Titel
   * einmal gestrichen wurde.
   */
  const [way, setWay] = useState<Way | null>(() => (roomFromLocation() === null ? null : 'join'));

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

  if (room === null) {
    /*
     * Der Eingang, in zwei Schritten: erst der Titel, dann die
     * Einrichtung. Ein Zweig und nicht zwei, damit der Fall darunter
     * nachweislich einen Raum hat - zwei getrennte `room === null`-Zweige
     * sagen dem Compiler nichts ueber den dritten.
     */
    screen =
      way === null ? (
        <MenuScreen
          onChoose={(choice) => {
            /*
             * **„Online" ist kein Weg zu einem Bildschirm, sondern eine
             * Handlung.** Dazwischen stand bis hierher die Einrichtung: drei
             * Angaben - Tischgroesse, Seed, Name -, und jede einzelne davon
             * laesst sich im Wartebereich auch machen. Ein Bildschirm, dessen
             * ganzer Inhalt eine Flaeche weiter noch einmal steht, ist ein
             * Zwischenhalt und keine Station.
             *
             * Der Raum entsteht deshalb sofort, mit gewuerfeltem Seed und dem
             * kleinsten Tisch. Beides ist im Wartebereich eine Zeile weit
             * entfernt, und wer nichts anfasst, hat trotzdem eine gueltige
             * Partie - das ist der Unterschied zwischen einer Vorgabe und
             * einer Frage.
             *
             * Der Name darf leer sein: `identify` schickt ihn dann gar nicht
             * hinaus, und der Server behaelt den, den er kennt. Umbenennen
             * kann man sich im Wartebereich.
             */
            if (choice === 'online') {
              void online.createRoom(MIN_SEATS, randomSeed(), loadName() ?? '');
              return;
            }
            setWay(choice);
          }}
          openGames={online.myRooms.length}
          identity={online.identity}
          onRegister={() => openAccount('register')}
          onLogin={() => openAccount('login')}
          onLogout={() => {
            void online.logout();
          }}
        />
      ) : (
        <StartScreen
          initialWay={way}
          onBack={() => setWay(null)}
          onStartLocal={onStartLocal}
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
          onAbandon={(code) => {
            void online.abandonRoom(code);
          }}
          onDelete={(code) => {
            void online.deleteRoom(code);
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
        onConfigure={(seatCount, seed, victoryPointGoal) => {
          void online.configureRoom(seatCount, seed, victoryPointGoal);
        }}
        onChooseColor={(color) => {
          void online.chooseColor(color);
        }}
        onRename={(name) => {
          void online.rename(name);
        }}
      />
    );
  } else {
    screen = (
      <GameScreen
        view={view}
        actions={shown.actions}
        log={shown.log}
        error={online.state.lastError}
        landing={shown.landing}
        over={online.state.over?.reason ?? null}
        onAct={(action) => {
          void online.act(action);
        }}
        onDismissError={online.dismissError}
        clockOffset={online.state.clockOffset}
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
