import { describe, expect, it } from 'vitest';
import {
  legalActions,
  setupPlayer,
  stampAction,
  type GameAction,
  type GameState,
} from '@conquerist/shared';
import {
  applyAction,
  applySystemAction,
  configureRoom,
  createRoom,
  joinRoom,
  leaveRoom,
  setConnected,
  startGame,
  type Room,
} from './room.js';

function room(): Room {
  const created = createRoom('K7X2', 'u1', 'Anna', 3, 'raum-probe');
  if (!created.ok) throw new Error(created.error);
  return created.room;
}

function withThree(): Room {
  let current = room();
  for (const [id, name] of [
    ['u2', 'Ben'],
    ['u3', 'Cem'],
  ] as const) {
    const joined = joinRoom(current, id, name);
    if (!joined.ok) throw new Error(joined.error);
    current = joined.room;
  }
  return current;
}

describe('Raum', () => {
  it('setzt den Ersteller auf den ersten Platz und macht ihn zum Host', () => {
    const created = room();
    expect(created.hostId).toBe('u1');
    expect(created.seats).toHaveLength(1);
    expect(created.seats[0]).toMatchObject({ userId: 'u1', name: 'Anna', connected: true });
    expect(created.game).toBeNull();
  });

  it('vergibt Farben in der Reihenfolge des Beitritts', () => {
    const full = withThree();
    expect(new Set(full.seats.map((seat) => seat.color)).size).toBe(3);
  });

  it('laesst niemanden zweimal beitreten, sondern erkennt ihn wieder', () => {
    const again = joinRoom(withThree(), 'u2', 'Ben');
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.room.seats).toHaveLength(3);
  });

  it('weist ab, wenn der Tisch voll ist', () => {
    const result = joinRoom(withThree(), 'u4', 'Dana');
    expect(result.ok).toBe(false);
  });

  it('startet nur auf Wunsch des Hosts', () => {
    const full = withThree();
    expect(startGame(full, 'u2').ok).toBe(false);

    const started = startGame(full, 'u1');
    expect(started.ok).toBe(true);
    if (started.ok) {
      expect(started.room.game).not.toBeNull();
      expect(started.room.version).toBeGreaterThan(full.version);
    }
  });

  it('startet nicht mit unvollstaendigem Tisch', () => {
    expect(startGame(room(), 'u1').ok).toBe(false);
  });

  it('nimmt einen Zug nur vom richtigen Spieler an', () => {
    const started = startGame(withThree(), 'u1');
    if (!started.ok) throw new Error(started.error);
    const running = started.room;
    const game = running.game!;

    const first = legalActions(game, setupPlayer(game)!)[0]!;
    const wrongPlayer = running.seats.find((seat) => seat.userId !== setupPlayer(game))!;

    // Fremder Zug: abgelehnt, Zustand unveraendert.
    const rejected = applyAction(running, wrongPlayer.userId, first);
    expect(rejected.ok).toBe(false);

    const accepted = applyAction(running, setupPlayer(game)!, first);
    expect(accepted.ok).toBe(true);
    if (accepted.ok) expect(accepted.room.version).toBe(running.version + 1);
  });

  it('laesst den Host die Partie im Wartebereich noch umstellen', () => {
    const changed = configureRoom(room(), 'u1', 5, 'anderer-seed');

    expect(changed.ok).toBe(true);
    if (changed.ok) {
      expect(changed.room.seatCount).toBe(5);
      expect(changed.room.seed).toBe('anderer-seed');
      expect(changed.room.version).toBeGreaterThan(room().version);
    }
  });

  it('laesst nur den Host umstellen', () => {
    expect(configureRoom(withThree(), 'u2', 6, 'egal').ok).toBe(false);
  });

  it('macht den Tisch nicht kleiner als die Zahl derer, die schon sitzen', () => {
    // Sonst muesste jemand seinen Platz raeumen, den er schon hat - und der
    // Wartebereich waere der falsche Ort, das zu entscheiden.
    expect(configureRoom(withThree(), 'u1', 3, 'raum-probe').ok).toBe(true);
    const shrunk = configureRoom(withThree(), 'u1', 2, 'raum-probe');
    expect(shrunk.ok).toBe(false);
  });

  it('weist eine Tischgroesse ohne passendes Brett zurueck', () => {
    expect(configureRoom(room(), 'u1', 7, 'raum-probe').ok).toBe(false);
  });

  it('stellt eine laufende Partie nicht mehr um', () => {
    const started = startGame(withThree(), 'u1');
    if (!started.ok) throw new Error(started.error);

    expect(configureRoom(started.room, 'u1', 4, 'zu-spaet').ok).toBe(false);
  });

  it('behaelt den Platz, wenn die Verbindung abbricht', () => {
    const gone = setConnected(withThree(), 'u2', false);
    expect(gone.seats).toHaveLength(3);
    expect(gone.seats.find((seat) => seat.userId === 'u2')?.connected).toBe(false);
  });

  it('gibt einen Platz im Wartebereich frei, aber nicht in der laufenden Partie', () => {
    const waiting = leaveRoom(withThree(), 'u2');
    expect(waiting.seats).toHaveLength(2);

    const started = startGame(withThree(), 'u1');
    if (!started.ok) throw new Error(started.error);
    const afterLeave = leaveRoom(started.room, 'u2');
    expect(afterLeave.seats).toHaveLength(3);
    expect(afterLeave.seats.find((seat) => seat.userId === 'u2')?.connected).toBe(false);
  });
});

describe('Zeit und Systemzuege', () => {
  /** Eine laufende Partie in der Hauptphase, u1 am Zug und mit drei Holz. */
  function inMainPhase(): Room {
    const started = startGame(withThree(), 'u1');
    if (!started.ok) throw new Error(started.error);
    const game = started.room.game!;

    const running: GameState = {
      ...game,
      phase: { kind: 'main' },
      currentPlayerIndex: 0,
      players: game.players.map((player, index) =>
        index === 0 ? { ...player, resources: { ...player.resources, lumber: 3 } } : player,
      ),
    };

    return { ...started.room, game: running };
  }

  const offer = (at: number): GameAction => ({
    type: 'offerTrade',
    player: 'u1',
    give: { brick: 0, lumber: 2, wool: 0, grain: 0, ore: 0 },
    want: { brick: 0, lumber: 0, wool: 0, grain: 0, ore: 1 },
    at,
  });

  function withOpenOffer(): Room {
    const acted = applyAction(inMainPhase(), 'u1', stampAction(offer(5), 10_000));
    if (!acted.ok) throw new Error(acted.error);
    return acted.room;
  }

  it('rechnet die Frist aus der gestempelten Zeit, nicht aus der mitgeschickten', () => {
    const room = withOpenOffer();
    const game = room.game!;

    expect(game.phase.kind).toBe('tradePending');
    if (game.phase.kind !== 'tradePending') return;
    expect(game.phase.expiresAt).toBe(10_000 + game.rules.tradeOfferMs);
  });

  it('weist einen Zug fuer einen anderen Spieler ab - auch einen Systemzug', () => {
    const room = withOpenOffer();

    // `dropFromTrade` spricht ueber u2, kaeme aber ueber die Verbindung von u1.
    const rejected = applyAction(room, 'u1', { type: 'dropFromTrade', player: 'u2' });

    expect(rejected.ok).toBe(false);
  });

  it('nimmt denselben Zug ueber den Systemeingang an', () => {
    const room = withOpenOffer();

    const accepted = applySystemAction(room, { type: 'dropFromTrade', player: 'u2' });

    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    const phase = accepted.room.game!.phase;
    expect(phase.kind).toBe('tradePending');
    if (phase.kind !== 'tradePending') return;
    expect(phase.responses.u2).toEqual({ kind: 'declined', automatic: true });
  });

  it('laesst die Frist nicht abkuerzen, solange sie laeuft', () => {
    const room = withOpenOffer();

    expect(applySystemAction(room, { type: 'timeout', player: 'u1', at: 10_001 }).ok).toBe(false);
    expect(
      applySystemAction(room, {
        type: 'timeout',
        player: 'u1',
        at: 10_000 + room.game!.rules.tradeOfferMs,
      }).ok,
    ).toBe(true);
  });
});
