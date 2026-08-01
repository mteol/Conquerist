import { useState, type JSX } from 'react';
import type { GameState } from '@conquerist/shared';
import type { Seat } from './seats';
import { GameScreen } from './screens/GameScreen';
import { StartScreen } from './screens/StartScreen';

/**
 * Zwei Bildschirme, mehr braucht Etappe 3 nicht: Start oder Partie.
 *
 * Kein Router - es gibt keine Adressen, die jemand teilen koennte. Das aendert
 * sich mit der Lobby in Etappe 6; dann mit Anlass.
 */
interface Session {
  readonly game: GameState;
  readonly seats: readonly Seat[];
}

export function App(): JSX.Element {
  const [session, setSession] = useState<Session | null>(null);

  if (session === null) {
    return <StartScreen onStart={(game, seats) => setSession({ game, seats })} />;
  }

  return <GameScreen game={session.game} seats={session.seats} onLeave={() => setSession(null)} />;
}
